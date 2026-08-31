'use strict';

require('dotenv').config();

const FormData = require('form-data');
// node-fetch v3 is ESM-only; use dynamic import wrapper
let _fetch;
async function getFetch() {
  if (!_fetch) {
    const mod = await import('node-fetch');
    _fetch = mod.default;
  }
  return _fetch;
}

const { SYSTEM_PROMPT, buildLeadExtractionPrompt } = require('./prompts');

const POLARGRID_BASE = `https://api.${process.env.POLARGRID_REGION || 'yto-01'}.edge.polargrid.ai`;
const API_KEY        = process.env.POLARGRID_API_KEY;

function authHeaders() {
  return { Authorization: `Bearer ${API_KEY}` };
}

// ---------------------------------------------------------------------------
// STT — Whisper
// ---------------------------------------------------------------------------

/**
 * Transcribe a WAV Buffer using PolarGrid Whisper.
 * @param {Buffer} wavBuffer
 * @returns {Promise<string>} transcript text
 */
async function transcribe(wavBuffer) {
  const fetch = await getFetch();
  const form  = new FormData();
  form.append('file', wavBuffer, { filename: 'audio.wav', contentType: 'audio/wav' });
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', 'en');  // lock to English — improves accuracy, reduces hallucinations
  form.append('prompt', 'Caller speaking to an auto repair shop receptionist. May mention car brands like Honda, Toyota, Ford, Chevrolet, Hyundai, Nissan, Mazda, Subaru, Volkswagen. May give a name, phone number, or describe car problems like brakes, oil change, engine, tires, transmission, check engine light.');

  const res = await fetch(`${POLARGRID_BASE}/v1/audio/transcriptions`, {
    method:  'POST',
    headers: { ...authHeaders(), ...form.getHeaders() },
    body:    form,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`STT error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return (data.text || '').trim();
}

// ---------------------------------------------------------------------------
// LLM — Qwen
// ---------------------------------------------------------------------------

/**
 * Get a chat completion from PolarGrid Qwen.
 * @param {Array<{role: string, content: string}>} messages
 * @returns {Promise<string>} assistant reply
 */
async function chat(messages) {
  const fetch = await getFetch();

  // Always prepend the system prompt
  const fullMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages,
  ];

  const res = await fetch(`${POLARGRID_BASE}/v1/chat/completions`, {
    method:  'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      model:       'qwen-3.5-27b',
      messages:    fullMessages,
      max_tokens:  80,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

// ---------------------------------------------------------------------------
// TTS — Kokoro (streaming)
// ---------------------------------------------------------------------------

/**
 * Convert text to speech using PolarGrid Kokoro.
 * Returns a Node.js ReadableStream of raw PCM16 mono at 24kHz chunks.
 * Caller reads chunks as they arrive for low-latency streaming to Twilio.
 * @param {string} text
 * @returns {Promise<import('stream').Readable>}
 */
async function ttsStream(text) {
  const fetch = await getFetch();

  const res = await fetch(`${POLARGRID_BASE}/v1/audio/speech`, {
    method:  'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      model:           'kokoro-82m',
      input:           text,
      voice:           'af_sky',
      response_format: 'pcm',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TTS error ${res.status}: ${body}`);
  }

  // node-fetch v3 body is a Node.js PassThrough stream — iterate it directly
  async function* streamChunks() {
    for await (const chunk of res.body) {
      yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    }
  }

  return streamChunks();
}

/**
 * Fallback: buffer full TTS response (used if streaming not needed).
 * @param {string} text
 * @returns {Promise<Buffer>}
 */
async function tts(text) {
  const stream = await ttsStream(text);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// Lead extraction
// ---------------------------------------------------------------------------

/**
 * Extract structured lead data from conversation history using the LLM.
 * @param {Array<{role: string, content: string}>} conversationHistory
 * @param {number} callDuration - call duration in seconds
 * @returns {Promise<object>} structured lead object
 */
async function extractLead(conversationHistory, callDuration) {
  const fetch = await getFetch();

  const extractionPrompt = buildLeadExtractionPrompt(conversationHistory);

  const res = await fetch(`${POLARGRID_BASE}/v1/chat/completions`, {
    method:  'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      model:       'qwen-3.5-27b',
      messages:    [{ role: 'user', content: extractionPrompt }],
      max_tokens:  512,
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Lead extraction LLM error ${res.status}: ${body}`);
  }

  const data    = await res.json();
  const rawText = (data.choices?.[0]?.message?.content || '').trim();

  let lead;
  try {
    // Strip any markdown code fences if the LLM wrapped it
    const cleaned = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    lead = JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse lead JSON:', rawText);
    lead = {};
  }

  lead.callDuration = callDuration;
  lead.timestamp    = new Date().toISOString();

  return lead;
}

module.exports = { transcribe, chat, tts, ttsStream, extractLead };
