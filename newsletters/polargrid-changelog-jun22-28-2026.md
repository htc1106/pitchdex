# Changelogs: Week of June 22, 2026

**Published:** June 29, 2026 · 5 min read

This week's work brought a new West Coast node online in Los Angeles, pushed Montreal's context window to 256k, eliminated cold starts on our most-used model, tightened cross-border routing for European traffic, resolved a TTS latency outlier on Toronto, and released SDK 0.9.1 for both JavaScript and Python.

---

## Los Angeles (lax-01) is live

PolarGrid now operates seven data centers across North America. The new Los Angeles node (lax-01) joins San Francisco and Vancouver on the West Coast, Dallas in South Central, and New York, Toronto, and Montreal on the East Coast.

For applications serving users in Southern California — voice pipelines, real-time inference, streaming completions — requests now terminate at a local edge rather than routing north to San Francisco. The latency reduction is most pronounced for time-sensitive workloads: voice agents and interactive applications where every hop compounds.

Los Angeles appears as a selectable region in the dashboard and playground dropdown. Health monitoring, latency-based routing, and automatic failover are all active on day one. The region is also reflected in the region catalog across our JS and Python SDKs — update to 0.9.1 and it's available immediately.

---

## Montreal (yul-02) now supports 256k context

The Montreal node's context window has expanded from 8,192 tokens to 256,000 — a 30× increase. This was made possible by enabling fp8 KV cache at 0.7 GPU utilization, which allows the node to hold far more of the conversation history in memory without exhausting VRAM.

The practical effect: long-document analysis, multi-turn research assistants, extended code reviews, and any workload that previously had to truncate or chunk inputs to fit within 8k are now unblocked on this node. The 256k window is available on the `qwen-3.6-35b-a3b` customer-pilot model running on yul-02. No configuration changes required — context handling expands automatically with the model.

---

## Cold start eliminated on qwen-3.5-27b

Previously, the first request to `qwen-3.5-27b` could incur a cold start of up to 30 seconds while the model loaded from disk into GPU memory. That wait is gone. The model now autoloads on node startup so it's warm before the first request arrives.

Cold starts of this length are an unreasonable tax on production applications — especially voice pipelines and interactive UIs where a multi-second stall on first use breaks the experience entirely. `qwen-3.5-27b` is one of the most widely used models on the platform, and this fix ensures it behaves consistently from the very first call of the day.

---

## 9× routing improvement for European traffic

London-origin requests were previously routing to Montreal (yul-02) at approximately 798ms. They now route to New York (nyc-01) at 84ms — a 9× reduction in cross-border latency.

This is a result of the network-region-aware fallback logic we shipped to the autorouter: the router now evaluates physical proximity and measured latency across healthy nodes before selecting a cross-border destination. Montreal is the right choice for many Canadian workloads. For European traffic, New York is meaningfully closer and consistently reachable. The routing table has been corrected accordingly.

Teams building latency-sensitive applications for European users — voice agents, real-time transcription, interactive inference — will see this improvement automatically without any API or SDK changes.

---

## TTS latency spike resolved on Toronto (yto-01)

The Toronto node (yto-01) was occasionally producing a 945ms first-audio latency outlier — roughly 3–4× the expected baseline. The root cause was traced to a specific interaction in the TTS warmup path and has been resolved.

Voice pipelines on yto-01 are now producing consistent first-audio latency. If your application targets Toronto for TTS and you observed intermittent slow-start audio this past week, this fix covers that.

---

## SDK 0.9.1 — JS and Python

Both SDKs have been updated to 0.9.1. Two additions in this release:

**`enable_thinking` for Qwen 3 models.** Set this parameter to `true` on any Qwen 3 request to activate the model's extended reasoning mode. The model works through the problem before producing a final answer, which improves quality on complex tasks: multi-step reasoning, structured planning, technical analysis. The default is `false` — standard completion behavior, fast and appropriate for most production requests. The toggle operates at the request level, so you can mix modes within the same application without separate model deployments.

**`tool_calls` in non-streaming completions.** Function call results are now correctly surfaced in non-streaming chat completions. Pass a `tools` array in your request; when the model invokes a function, the response includes a structured `tool_calls` object. The interface follows the OpenAI chat completions shape — existing tool-calling integrations require minimal changes to adopt.

Update with:
```bash
npm install @polargrid/sdk@0.9.1   # JavaScript
pip install polargrid==0.9.1       # Python
```

---

*$500 in free credits. No card required. Sub-400ms voice pipeline live now.*
[**Start Free →**](https://app.polargrid.ai)
