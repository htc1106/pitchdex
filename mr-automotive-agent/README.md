# M.R. Automotive — AI Voice Receptionist

A Node.js AI voice receptionist for **M.R. Automotive** (Whitby, ON) that handles inbound calls via Twilio, conducts a lead-collection conversation using AI, and sends SMS + email notifications on call completion.

## Architecture

```
Inbound Call (Twilio)
        │
        ▼
POST /incoming-call  →  TwiML response (opens WebSocket media stream)
        │
        ▼
WSS /media-stream  ←→  Twilio Media Stream (base64 mulaw @ 8kHz)
        │
        ▼
  VoiceSession.js  (per-call state, VAD, conversation history)
        │
    ┌───┴────────────┐
    │                │
    ▼                ▼
  STT              TTS
(Whisper)        (Kokoro)
    │                ▲
    ▼                │
   LLM ─────────────┘
  (Qwen)
        │
        ▼ (on call end)
  Lead Extraction  →  SMS (Twilio) + Email (Resend)
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

Key variables:

| Variable | Description |
|---|---|
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Your Twilio number (e.g. `+14284365529`) |
| `POLARGRID_API_KEY` | PolarGrid API key |
| `POLARGRID_REGION` | PolarGrid region (e.g. `yto-01`) |
| `RESEND_API_KEY` | Resend API key |
| `SMS_RECIPIENTS` | Comma-separated phone numbers |
| `EMAIL_RECIPIENTS` | Comma-separated email addresses |
| `PORT` | HTTP port (default: 3000) |
| `PUBLIC_URL` | **Required for Twilio** — public HTTPS URL of this server |

### 3. Set PUBLIC_URL

`PUBLIC_URL` must be set to the publicly accessible HTTPS URL where Twilio can reach this server.

**Local development with ngrok:**
```bash
ngrok http 3000
# Copy the https://xxxxx.ngrok.io URL
# Set PUBLIC_URL=https://xxxxx.ngrok.io in .env
```

**Production (Railway):**
```bash
railway up
# Set PUBLIC_URL=https://your-app.up.railway.app
```

**Production (Fly.io):**
```bash
fly launch
fly deploy
# Set PUBLIC_URL=https://your-app.fly.dev
```

### 4. Configure Twilio

1. Go to Twilio Console → Phone Numbers → your number
2. Set **Voice webhook** to `POST https://your-server.example.com/incoming-call`
3. Make sure HTTP POST is selected

### 5. Start the server

```bash
npm start
# or for development with auto-reload:
npm run dev
```

## Audio Pipeline

### Inbound (caller → STT)
1. Twilio sends base64-encoded μ-law audio chunks via WebSocket
2. Each chunk is decoded from μ-law to PCM16
3. Energy-based VAD detects speech/silence (RMS threshold: 200, silence threshold: ~600ms)
4. On end-of-turn: builds WAV file and sends to PolarGrid Whisper
5. Transcript returned to LLM pipeline

### Outbound (TTS → caller)
1. LLM response text sent to PolarGrid Kokoro (returns raw PCM16 at 24kHz)
2. Downsampled 24kHz → 8kHz (simple 3:1 decimation)
3. Encoded PCM16 → μ-law
4. Base64-encoded and streamed back to Twilio in chunks

### Barge-in
If the caller speaks while Sarah is talking, TTS is interrupted immediately.

## Lead Collection

Sarah collects these fields naturally in conversation:
- Full name
- Phone number (confirmed by readback)
- Email address (spelled out)
- Service needed
- Vehicle year/make/model + AWD
- New or returning customer
- If new: referral source
- Additional notes/comments

On call end, the conversation is passed to the LLM for structured extraction, then sent via:
- **SMS** to all `SMS_RECIPIENTS`
- **HTML email** to all `EMAIL_RECIPIENTS`

## Project Structure

```
mr-automotive-agent/
├── server.js          # Express HTTP + WebSocket upgrade handler
├── voiceSession.js    # Per-call state: audio buffering, VAD, conversation
├── pipeline.js        # PolarGrid STT → LLM → TTS pipeline
├── audioUtils.js      # μ-law codec + WAV builder + resampler
├── notifications.js   # SMS (Twilio) + Email (Resend) sender
├── prompts.js         # System prompt + lead extraction prompt
├── package.json
├── .env               # Your credentials (never commit this!)
└── .env.example       # Template
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/incoming-call` | Twilio webhook — returns TwiML |
| GET | `/health` | Health check |
| WS | `/media-stream` | Twilio media stream WebSocket |

## Deployment Notes

- Requires Node.js 18+
- No persistent storage needed — all state is per-call in memory
- Scale to multiple instances is safe (each call is fully self-contained)
- For high volume: consider adding a connection limit and graceful timeout for stuck calls

## Troubleshooting

**No audio / silence on call:**
- Check `PUBLIC_URL` is correct and publicly accessible
- Check Twilio webhook is set to POST `/incoming-call`
- Confirm PolarGrid API key and region are correct

**STT returning empty:**
- The VAD threshold may need tuning. Adjust `VAD_SILENCE_RMS` in `voiceSession.js`

**TTS latency is high:**
- PolarGrid Kokoro runs in the `yto-01` (Toronto) region for lowest latency
- Ensure `POLARGRID_REGION=yto-01` is set

**SMS/Email not sending:**
- Check Twilio number has SMS capability
- Check Resend domain verification for production sender
- Verify recipient numbers include country code
