'use strict';

require('dotenv').config();

const express    = require('express');
const http       = require('http');
const path       = require('path');
const { WebSocketServer } = require('ws');
const VoiceSession = require('./voiceSession');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ noServer: true });

const PORT       = parseInt(process.env.PORT || '3000', 10);
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');

// ---------------------------------------------------------------------------
// HTTP routes
// ---------------------------------------------------------------------------

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Workshop chat UI (text-only, no audio)
// ---------------------------------------------------------------------------

let workshopHistory = [];

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/chat', async (req, res) => {
  const { message, reset } = req.body;

  if (reset) {
    workshopHistory = [];
    const greeting = require('./prompts').GREETING;
    workshopHistory.push({ role: 'assistant', content: greeting });
    return res.json({ reply: greeting });
  }

  if (!message) return res.status(400).json({ error: 'message required' });

  workshopHistory.push({ role: 'user', content: message });

  try {
    const reply = await require('./pipeline').chat(workshopHistory);
    workshopHistory.push({ role: 'assistant', content: reply });

    // Trim to last 20 messages
    if (workshopHistory.length > 20) {
      workshopHistory = workshopHistory.slice(workshopHistory.length - 20);
    }

    res.json({ reply });
  } catch (err) {
    console.error('[/api/chat] Error:', err);
    res.status(500).json({ error: 'Sarah encountered an error. Check the server logs.' });
  }
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

/**
 * POST /incoming-call
 * Twilio calls this when a new inbound call arrives.
 * Responds with TwiML to open a media stream.
 */
app.post('/incoming-call', (req, res) => {
  const callSid = req.body?.CallSid || 'unknown';
  console.log(`[${callSid}] Incoming call. Sending TwiML.`);

  if (!PUBLIC_URL) {
    console.error('PUBLIC_URL is not set! Media stream URL will be invalid.');
  }

  // Build WebSocket URL: https → wss, http → ws
  const wsUrl = (PUBLIC_URL || `http://localhost:${PORT}`)
    .replace(/^https:\/\//, 'wss://')
    .replace(/^http:\/\//, 'ws://') + '/media-stream';

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}" />
  </Connect>
</Response>`;

  res.type('text/xml').send(twiml);
});

// ---------------------------------------------------------------------------
// WebSocket upgrade (only for /media-stream path)
// ---------------------------------------------------------------------------

server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url, `http://${request.headers.host}`);

  if (pathname === '/media-stream') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// ---------------------------------------------------------------------------
// WebSocket connection handler
// ---------------------------------------------------------------------------

wss.on('connection', (ws, req) => {
  console.log('WebSocket connection opened from', req.socket.remoteAddress);

  const session = new VoiceSession(ws);

  ws.on('message', async (data) => {
    try {
      await session.handleMessage(data.toString());
    } catch (err) {
      console.error('Unhandled session error:', err);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`WebSocket closed: ${code} ${reason}`);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`M.R. Automotive AI Voice Receptionist`);
  console.log(`Listening on port ${PORT}`);
  console.log(`PUBLIC_URL: ${PUBLIC_URL || '(not set — set this before deploying!)'}`);
  console.log(`Twilio webhook: POST ${PUBLIC_URL}/incoming-call`);
  console.log(`Media stream:   wss${PUBLIC_URL.replace(/^https?/, '')}/media-stream`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  server.close(() => process.exit(0));
});

module.exports = { app, server };
