'use strict';

const { mulawBufferToPcm16, pcm16ToMulawBuffer, buildWav, resample24to8, rms } = require('./audioUtils');
const { transcribe, chat, tts, extractLead } = require('./pipeline');
const { sendNotifications } = require('./notifications');
const { GREETING, REPROMPT } = require('./prompts');

// VAD configuration
const VAD_CHUNK_SAMPLES     = 160;  // 20ms at 8kHz
const VAD_SILENCE_RMS        = 300;  // energy threshold — speech ~300-3000, hiss ~50-150
const VAD_SILENCE_CHUNKS     = 10;   // ~200ms of silence triggers STT
const VAD_SILENCE_CHUNKS_NUM = 20;   // ~400ms for numbers — people pause between digit groups
const VAD_MIN_SPEECH_CHUNKS  = 3;    // ignore bursts shorter than ~60ms (clicks/pops)

// Max conversation turns to keep (20 messages = 10 turns)
const MAX_HISTORY_MESSAGES = 20;

// Chunk size for streaming TTS to Twilio (in mulaw bytes)
const TTS_CHUNK_SIZE = 320; // 40ms at 8kHz

/**
 * VoiceSession — manages per-call state.
 */
class VoiceSession {
  /**
   * @param {import('ws').WebSocket} ws - Twilio WebSocket connection
   */
  constructor(ws) {
    this.ws = ws;

    // Call metadata
    this.streamSid = null;
    this.callSid   = null;
    this.startTime = Date.now();

    // Audio buffering
    this.pcmBuffer        = [];          // Array of Int16Array chunks
    this.silenceChunks    = 0;
    this.speechChunks     = 0;           // count of consecutive speech chunks
    this.hasSpeech        = false;       // has any speech been detected this turn?

    // Conversation state
    this.history          = [];          // [{role, content}]
    this.isProcessing     = false;       // STT/LLM/TTS in progress
    this.isTtsPlaying     = false;       // currently streaming TTS to Twilio
    this.ttsAbortFlag     = false;       // set to true to interrupt TTS
    this.ttsCooldownUntil = 0;           // timestamp: ignore audio until after this (post-TTS cooldown)

    // Track if we've sent the greeting
    this.greeted          = false;

    // When true, use longer silence window (expecting digits with natural pauses)
    this.expectingNumber  = false;
  }

  // ---------------------------------------------------------------------------
  // Inbound message handler
  // ---------------------------------------------------------------------------

  /**
   * Handle a raw Twilio WebSocket message.
   * @param {string} rawMessage
   */
  async handleMessage(rawMessage) {
    let msg;
    try {
      msg = JSON.parse(rawMessage);
    } catch {
      return;
    }

    switch (msg.event) {
      case 'start':
        await this._handleStart(msg);
        break;
      case 'media':
        this._handleMedia(msg);
        break;
      case 'stop':
        await this._handleStop(msg);
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  async _handleStart(msg) {
    this.streamSid = msg.streamSid;
    this.callSid   = msg.start?.callSid;
    this.startTime = Date.now();
    console.log(`[${this.callSid}] Call started. StreamSid: ${this.streamSid}`);

    // Send greeting immediately
    if (!this.greeted) {
      this.greeted = true;
      await this._speak(GREETING, /* isGreeting */ true);
    }
  }

  _handleMedia(msg) {
    if (!msg.media?.payload) return;

    const mulawBuf = Buffer.from(msg.media.payload, 'base64');
    const pcm16    = mulawBufferToPcm16(mulawBuf);
    const energy   = rms(pcm16);

    // Barge-in: only interrupt TTS if caller speaks very loudly (well above background)
    if (this.isTtsPlaying && energy > VAD_SILENCE_RMS * 8) {
      console.log(`[${this.callSid}] Barge-in detected (energy=${Math.round(energy)}), interrupting TTS`);
      this.ttsAbortFlag     = true;
      this.isTtsPlaying     = false;
      this.ttsCooldownUntil = 0; // allow listening immediately after barge-in
    }

    // Don't buffer audio while processing, TTS playing, or in post-TTS cooldown
    if (this.isProcessing || this.isTtsPlaying) return;
    if (Date.now() < this.ttsCooldownUntil) return;

    // VAD processing — work in 160-sample chunks
    let offset = 0;
    while (offset + VAD_CHUNK_SAMPLES <= pcm16.length) {
      const chunk       = pcm16.slice(offset, offset + VAD_CHUNK_SAMPLES);
      const chunkEnergy = rms(chunk);

      if (chunkEnergy > VAD_SILENCE_RMS) {
        // Speech detected
        this.hasSpeech    = true;
        this.silenceChunks = 0;
        this.speechChunks++;
        this.pcmBuffer.push(chunk);
      } else {
        // Silence
        if (this.hasSpeech) {
          this.pcmBuffer.push(chunk);
          this.silenceChunks++;

          const silenceThreshold = this.expectingNumber ? VAD_SILENCE_CHUNKS_NUM : VAD_SILENCE_CHUNKS;
          if (this.silenceChunks >= silenceThreshold) {
            // Only trigger STT if we heard enough real speech (not just noise)
            if (this.speechChunks >= VAD_MIN_SPEECH_CHUNKS) {
              this._triggerStt();
            } else {
              console.log(`[${this.callSid}] Discarding short burst (${this.speechChunks} chunks — noise)`);
              this._resetVad();
            }
          }
        }
      }

      offset += VAD_CHUNK_SAMPLES;
    }

    // Handle any remaining samples
    if (offset < pcm16.length) {
      const remainder = pcm16.slice(offset);
      if (this.hasSpeech) this.pcmBuffer.push(remainder);
    }
  }

  _resetVad() {
    this.pcmBuffer    = [];
    this.hasSpeech    = false;
    this.silenceChunks = 0;
    this.speechChunks  = 0;
  }

  async _handleStop(_msg) {
    console.log(`[${this.callSid}] Call stopped. Processing end-of-call.`);
    // Small delay to let any last audio flush through
    await new Promise(r => setTimeout(r, 2000));
    await this._endCall();
  }

  // ---------------------------------------------------------------------------
  // Speech pipeline
  // ---------------------------------------------------------------------------

  _triggerStt() {
    if (this.isProcessing) return;

    // Capture and reset buffer
    const samples = this._drainBuffer();
    this._resetVad();

    if (samples.length < VAD_CHUNK_SAMPLES * 2) {
      // Too short — ignore
      return;
    }

    this.expectingNumber = false; // reset after each turn
    this.isProcessing    = true;
    this._runPipeline(samples).finally(() => {
      this.isProcessing = false;
    });
  }

  async _runPipeline(pcm16Samples) {
    try {
      // Build WAV and transcribe
      const wavBuf     = buildWav(pcm16Samples, 8000, 1);
      const transcript = await transcribe(wavBuf);

      console.log(`[${this.callSid}] STT: "${transcript}"`);

      if (!transcript || transcript.length < 2) {
        // Empty / noise — re-prompt
        await this._speak(REPROMPT);
        return;
      }

      // Add to history
      this._addHistory('user', transcript);

      // Get LLM reply
      let reply = await chat(this.history);
      console.log(`[${this.callSid}] LLM: "${reply}"`);

      if (!reply) return;

      // Strip any [HANGUP] token — customer hangs up naturally
      const spokenReply = reply.replace('[HANGUP]', '').trim();

      // Detect if Sarah is asking for a phone number — use longer VAD window
      const askingForNumber = /phone number|call you back at|reach you at|best number/i.test(spokenReply);
      this.expectingNumber  = askingForNumber;

      // Add to history and speak
      this._addHistory('assistant', spokenReply);
      await this._speak(spokenReply);
    } catch (err) {
      console.error(`[${this.callSid}] Pipeline error:`, err);
      try {
        await this._speak("I'm sorry, I'm having a little trouble right now. Could you say that again?");
      } catch { /* ignore */ }
    }
  }

  // ---------------------------------------------------------------------------
  // TTS → Twilio streaming
  // ---------------------------------------------------------------------------

  /**
   * Convert text to speech and stream mulaw audio to Twilio in real-time.
   * Uses PolarGrid streaming TTS — first audio bytes sent as soon as they
   * arrive from the API, without waiting for the full response to buffer.
   * @param {string} text
   */
  async _speak(text) {
    if (!this.streamSid) {
      console.warn(`[${this.callSid}] Cannot speak — no streamSid yet`);
      return;
    }

    this.isTtsPlaying = true;
    this.ttsAbortFlag = false;
    // Flush any audio buffered before TTS started — it could be our own echo
    this._resetVad();

    try {
      console.log(`[${this.callSid}] TTS start: "${text.slice(0, 60)}..."`);

      // Fetch full PCM24 buffer from PolarGrid
      const pcm24Buf = await tts(text);
      console.log(`[${this.callSid}] TTS received ${pcm24Buf.length} bytes PCM24`);

      // Resample 24kHz → 8kHz with FIR filter, encode to mulaw
      const pcm8     = resample24to8(pcm24Buf);
      const mulawBuf = pcm16ToMulawBuffer(pcm8);
      console.log(`[${this.callSid}] TTS encoded ${mulawBuf.length} bytes mulaw`);

      // Stream mulaw chunks to Twilio at real-time pace.
      // mulaw 8kHz = 8000 bytes/sec. TTS_CHUNK_SIZE bytes = TTS_CHUNK_SIZE/8 ms of audio.
      // By pacing sends to match playback speed, we stay synchronized with Twilio's
      // playout buffer — no post-send wait needed.
      const MS_PER_CHUNK = (TTS_CHUNK_SIZE / 8000) * 1000; // ms of audio per chunk
      let offset         = 0;
      let bytesSent      = 0;
      const playStart    = Date.now();

      while (offset < mulawBuf.length) {
        if (this.ttsAbortFlag) {
          console.log(`[${this.callSid}] TTS interrupted by barge-in at ${offset}/${mulawBuf.length} bytes`);
          break;
        }

        const chunkStart = Date.now();
        const chunk      = mulawBuf.slice(offset, offset + TTS_CHUNK_SIZE);
        offset    += TTS_CHUNK_SIZE;
        bytesSent += chunk.length;

        if (this.ws.readyState === this.ws.OPEN) {
          this.ws.send(JSON.stringify({
            event:     'media',
            streamSid: this.streamSid,
            media:     { payload: chunk.toString('base64') },
          }));
        } else {
          console.warn(`[${this.callSid}] WebSocket not open, stopping TTS`);
          break;
        }

        // Pace to real-time: wait remaining ms for this chunk's duration
        const sendTime  = Date.now() - chunkStart;
        const sleepTime = Math.max(0, MS_PER_CHUNK - sendTime);
        if (sleepTime > 0) await new Promise(r => setTimeout(r, sleepTime));
      }

      if (!this.ttsAbortFlag && this.ws.readyState === this.ws.OPEN) {
        this.ws.send(JSON.stringify({
          event:     'mark',
          streamSid: this.streamSid,
          mark:      { name: 'response_end' },
        }));
      }

      // Since we paced sends to real-time, audio is done playing now.
      // Just a short buffer for echo/reverb to clear.
      const sentDurationMs = (bytesSent / 8000) * 1000;
      console.log(`[${this.callSid}] TTS done — ${Math.round(sentDurationMs)}ms audio, 200ms echo buffer`);
      this.ttsCooldownUntil = Date.now() + 200;
      this._resetVad();
    } catch (err) {
      console.error(`[${this.callSid}] TTS error:`, err.message);
    } finally {
      this.isTtsPlaying = false;
      this.ttsAbortFlag = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Hang up
  // ---------------------------------------------------------------------------

  async _hangup() {
    try {
      const twilio = require('twilio')(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      await twilio.calls(this.callSid).update({ status: 'completed' });
      console.log(`[${this.callSid}] Call terminated via Twilio API`);
    } catch (err) {
      console.error(`[${this.callSid}] Hangup error:`, err.message);
    }
  }

  // ---------------------------------------------------------------------------
  // End of call
  // ---------------------------------------------------------------------------

  async _endCall() {
    const callDuration = Math.round((Date.now() - this.startTime) / 1000);
    console.log(`[${this.callSid}] Call ended. Duration: ${callDuration}s. History: ${this.history.length} messages.`);

    if (this.history.length === 0) {
      console.log(`[${this.callSid}] No conversation history — skipping lead extraction.`);
      return;
    }

    try {
      const lead = await extractLead(this.history, callDuration);
      console.log(`[${this.callSid}] Lead extracted:`, lead);
      await sendNotifications(lead);
    } catch (err) {
      console.error(`[${this.callSid}] End-of-call processing error:`, err);
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  _drainBuffer() {
    // Flatten Int16Array chunks into one large Int16Array
    const totalLen = this.pcmBuffer.reduce((sum, c) => sum + c.length, 0);
    const out      = new Int16Array(totalLen);
    let   pos      = 0;
    for (const chunk of this.pcmBuffer) {
      out.set(chunk, pos);
      pos += chunk.length;
    }
    this.pcmBuffer = [];
    return out;
  }

  _addHistory(role, content) {
    this.history.push({ role, content });
    // Trim to last MAX_HISTORY_MESSAGES messages
    if (this.history.length > MAX_HISTORY_MESSAGES) {
      this.history = this.history.slice(this.history.length - MAX_HISTORY_MESSAGES);
    }
  }
}

module.exports = VoiceSession;
