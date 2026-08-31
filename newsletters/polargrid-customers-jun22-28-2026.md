# PolarGrid Product Update | June 22–28, 2026

---

Hi there,

Here's what shipped this week across our network and SDKs.

---

## This Week

- **Los Angeles (lax-01) is now live.** A new edge region is online and available across routing, client, and both JS and Python SDKs. Updated your SDK? You're already connected.

- **Montreal (yul-02) now supports 256k context.** We upgraded the context window from 8,192 tokens to 256k via fp8 KV cache — a 30× increase. Long-document analysis, extended conversations, and large-context workloads are now unblocked on this node.

- **Cold start eliminated on qwen-3.5-27b.** Your first request to this model no longer waits up to 30 seconds. The model now autoloads — inference starts immediately.

- **9× routing improvement for European traffic.** London-origin requests now route to New York (84ms) instead of Montreal (798ms). Cross-border routing is now latency-aware.

- **TTS latency spike fixed on Toronto (yto-01).** A 945ms first-audio outlier was tracked down and resolved. Voice pipelines on this node are back to expected latency.

- **SDK 0.9.1 released** (JS + Python). New this release: Qwen3 `enable_thinking` toggle for reasoning control, and `tool_calls` now surfaces correctly in non-streaming chat completions. Upgrade when you can.

---

That's the week. More next Sunday.

— The PolarGrid Team
