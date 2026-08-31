'use strict';

/**
 * audioUtils.js
 * μ-law codec, WAV builder, and PCM resampler for Twilio Media Streams.
 *
 * Twilio uses PCMU (μ-law) at 8kHz mono.
 * PolarGrid TTS returns PCM16 at 24kHz mono.
 */

// Use battle-tested ITU-T G.711 implementation
const alawmulaw = require('alawmulaw');

// ---------------------------------------------------------------------------
// μ-law codec — backed by alawmulaw (ITU-T G.711 compliant)
// ---------------------------------------------------------------------------

/**
 * Decode one μ-law byte to a signed 16-bit PCM sample.
 * @param {number} u - single μ-law encoded byte (0-255)
 * @returns {number} PCM16 sample (-32768 to 32767)
 */
function mulawDecode(u) {
  return alawmulaw.mulaw.decodeSample(u);
}

/**
 * Encode a signed 16-bit PCM sample to a μ-law byte.
 * @param {number} sample - PCM16 sample (-32768 to 32767)
 * @returns {number} μ-law byte (0-255)
 */
function mulawEncode(sample) {
  return alawmulaw.mulaw.encodeSample(sample);
}

// ---------------------------------------------------------------------------
// Buffer converters
// ---------------------------------------------------------------------------

/**
 * Decode a Buffer of μ-law bytes to an Int16Array of PCM16 samples.
 * @param {Buffer} mulawBuf
 * @returns {Int16Array}
 */
function mulawBufferToPcm16(mulawBuf) {
  const samples = new Int16Array(mulawBuf.length);
  for (let i = 0; i < mulawBuf.length; i++) {
    samples[i] = mulawDecode(mulawBuf[i]);
  }
  return samples;
}

/**
 * Encode an Int16Array of PCM16 samples to a Buffer of μ-law bytes.
 * encodeSample returns a signed int8 — mask with 0xff to get the unsigned byte.
 * @param {Int16Array} pcm16
 * @returns {Buffer}
 */
function pcm16ToMulawBuffer(pcm16) {
  const out = Buffer.allocUnsafe(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    out[i] = alawmulaw.mulaw.encodeSample(pcm16[i]) & 0xff;
  }
  return out;
}

// ---------------------------------------------------------------------------
// WAV builder (44-byte header + PCM16 samples, 8kHz mono)
// ---------------------------------------------------------------------------

/**
 * Build a WAV file Buffer from PCM16 samples.
 * @param {Int16Array} pcm16Samples
 * @param {number} [sampleRate=8000]
 * @param {number} [numChannels=1]
 * @returns {Buffer}
 */
function buildWav(pcm16Samples, sampleRate = 8000, numChannels = 1) {
  const bitsPerSample = 16;
  const byteRate      = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign    = numChannels * (bitsPerSample / 8);
  const dataSize      = pcm16Samples.length * 2; // 2 bytes per sample
  const headerSize    = 44;
  const buf           = Buffer.allocUnsafe(headerSize + dataSize);

  // RIFF chunk
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);

  // fmt sub-chunk
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);           // sub-chunk size
  buf.writeUInt16LE(1, 20);            // PCM = 1
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  // PCM16 samples (little-endian)
  for (let i = 0; i < pcm16Samples.length; i++) {
    buf.writeInt16LE(pcm16Samples[i], headerSize + i * 2);
  }

  return buf;
}

// ---------------------------------------------------------------------------
// Resampler: 24kHz → 8kHz (simple 3:1 decimation — adequate for voice)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// FIR low-pass filter for anti-aliasing before 3:1 decimation
// ---------------------------------------------------------------------------
// Also exposed as a stateful streaming version for low-latency TTS streaming.
// 31-tap windowed-sinc filter, Hamming window, cutoff 3800 Hz at 24kHz input.
// This removes frequencies above the 4kHz Nyquist limit of the 8kHz output,
// preventing the aliasing distortion (fuzz) caused by naive decimation.

const FIR_TAPS = (() => {
  const numTaps  = 31;
  const M        = numTaps - 1;
  const fc       = 3800 / 24000; // normalised cutoff (fraction of input sample rate)
  const taps     = new Float64Array(numTaps);

  for (let n = 0; n <= M; n++) {
    const mid = M / 2;
    // Windowed sinc
    taps[n] = (n === mid)
      ? 2 * fc
      : Math.sin(2 * Math.PI * fc * (n - mid)) / (Math.PI * (n - mid));
    // Hamming window
    taps[n] *= 0.54 - 0.46 * Math.cos(2 * Math.PI * n / M);
  }
  return taps;
})();

/**
 * Downsample PCM16 data from 24kHz to 8kHz.
 * Applies a 31-tap FIR low-pass filter before 3:1 decimation to eliminate
 * aliasing artifacts. Input is a raw Buffer of little-endian PCM16 samples.
 * @param {Buffer} pcm24Buffer - raw PCM16 LE bytes at 24kHz
 * @returns {Int16Array} PCM16 samples at 8kHz
 */
function resample24to8(pcm24Buffer) {
  const totalSamples = Math.floor(pcm24Buffer.length / 2);

  // Read all 24kHz samples into a Float64Array for filtering
  const src = new Float64Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    src[i] = pcm24Buffer.readInt16LE(i * 2);
  }

  const numTaps  = FIR_TAPS.length;
  const outLen   = Math.floor(totalSamples / 3);
  const out      = new Int16Array(outLen);

  for (let i = 0; i < outLen; i++) {
    const srcIdx = i * 3; // centre sample for this output
    let   sum    = 0;

    for (let t = 0; t < numTaps; t++) {
      const idx = srcIdx - Math.floor(numTaps / 2) + t;
      if (idx >= 0 && idx < totalSamples) {
        sum += FIR_TAPS[t] * src[idx];
      }
    }

    // Clamp to int16 range
    out[i] = Math.max(-32768, Math.min(32767, Math.round(sum)));
  }

  return out;
}

// ---------------------------------------------------------------------------
// Energy / RMS helpers
// ---------------------------------------------------------------------------

/**
 * Calculate RMS energy of an Int16Array chunk.
 * @param {Int16Array} samples
 * @returns {number}
 */
function rms(samples) {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

// ---------------------------------------------------------------------------
// Streaming resampler — processes PCM24 in real-time chunks
// ---------------------------------------------------------------------------

/**
 * Creates a stateful streaming resampler from 24kHz to 8kHz.
 * Feed raw PCM16LE Buffer chunks as they arrive; get back mulaw Buffer chunks
 * ready to send to Twilio immediately.
 *
 * Maintains a carry buffer for the FIR filter history and handles partial
 * 3-sample groups across chunk boundaries.
 *
 * @returns {{ push(chunk: Buffer): Buffer, flush(): Buffer }}
 */
function createStreamingResampler() {
  const numTaps    = FIR_TAPS.length;
  const halfTaps   = Math.floor(numTaps / 2);

  // History of input samples for FIR (as Float64Array ring)
  const history    = new Float64Array(numTaps).fill(0);
  let   histHead   = 0; // ring buffer write head

  // Carry-over fractional samples (0, 1, or 2 PCM16 samples not yet consumed)
  let   carry      = new Float64Array(2);
  let   carryLen   = 0;

  function pushSample(s) {
    history[histHead] = s;
    histHead = (histHead + 1) % numTaps;
  }

  function filterOutput() {
    let sum = 0;
    for (let t = 0; t < numTaps; t++) {
      // Most recent sample is at histHead-1 (mod numTaps)
      const idx = (histHead - 1 - t + numTaps * 2) % numTaps;
      sum += FIR_TAPS[numTaps - 1 - t] * history[idx];
    }
    return Math.max(-32768, Math.min(32767, Math.round(sum)));
  }

  function push(pcm24Chunk) {
    // Read samples from chunk into a flat array, prepend carry
    const chunkSamples = Math.floor(pcm24Chunk.length / 2);
    const total        = carryLen + chunkSamples;
    const src          = new Float64Array(total);

    for (let i = 0; i < carryLen; i++) src[i] = carry[i];
    for (let i = 0; i < chunkSamples; i++) {
      src[carryLen + i] = pcm24Chunk.readInt16LE(i * 2);
    }

    // How many complete 3-sample groups can we output?
    const outSamples = Math.floor(total / 3);
    const consumed   = outSamples * 3;
    const remaining  = total - consumed;

    // Save leftover samples for next call
    carryLen = remaining;
    for (let i = 0; i < remaining; i++) carry[i] = src[consumed + i];

    // Process each output sample
    const outMulaw = Buffer.allocUnsafe(outSamples);
    for (let i = 0; i < outSamples; i++) {
      // Feed 3 input samples through FIR, output at the middle one
      for (let j = 0; j < 3; j++) {
        pushSample(src[i * 3 + j]);
      }
      const pcmOut = filterOutput();
      outMulaw[i]  = mulawEncode(pcmOut);
    }

    return outMulaw;
  }

  function flush() {
    if (carryLen === 0) return Buffer.alloc(0);
    // Pad with zeros and output remaining
    const padded = new Float64Array(3);
    for (let i = 0; i < carryLen; i++) padded[i] = carry[i];
    for (let j = 0; j < 3; j++) pushSample(padded[j]);
    const pcmOut = filterOutput();
    carryLen = 0;
    const out = Buffer.allocUnsafe(1);
    out[0] = mulawEncode(pcmOut);
    return out;
  }

  return { push, flush };
}

module.exports = {
  mulawDecode,
  mulawEncode,
  mulawBufferToPcm16,
  pcm16ToMulawBuffer,
  buildWav,
  resample24to8,
  rms,
  createStreamingResampler,
};
