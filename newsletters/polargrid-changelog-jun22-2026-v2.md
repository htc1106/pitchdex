# Changelogs: Week of June 22, 2026

**Published:** June 29, 2026 · 5 min read

This week's work extended the network to Seattle, shipped 256k context on our most capable model, made country-aware routing the default, added function calling to both SDKs, eliminated voice pipeline cold starts, and put the first customer voice agent into production.

---

## Seattle is live

PolarGrid now has a presence in the Pacific Northwest. The new Seattle node brings low-latency inference to users across Washington, Oregon, and British Columbia — a region that previously had to route to San Francisco or Vancouver depending on load.

The node is available immediately as a selectable region in the dashboard, the playground dropdown, and both SDKs. If you're already on JS or Python SDK 0.9.1, Seattle appears in your region list with no update required. Health monitoring, latency-based routing, and automatic failover are active from day one.

---

## 256k context window on Qwen 3.6 35B

The 256k context window is now available on `qwen-3.6-35b-a3b` — our highest-capability model on the network. The previous limit was 8,192 tokens. That's a 30× increase.

In practice, this removes the workaround most long-context applications have lived with: chunking documents into pieces, building retrieval pipelines to pre-select context, or truncating history to keep conversations within limits. With 256k available, a 200-page document fits in a single request. A multi-hour conversation fits without rolling the window. A large codebase fits without selecting which files matter.

No configuration changes are required. Context handling expands automatically with the model — send longer inputs and the model handles them.

---

## Country-aware routing is on by default

The PolarGrid autorouter now applies country-aware routing by default across all inference requests. When a request arrives, the router evaluates healthy nodes within the originating country first. A cross-border hop only occurs when every in-country node is unavailable or degraded.

The practical effect is twofold. For most requests, latency improves because in-country nodes are physically closer. And for teams operating under data residency requirements or internal policies around cross-border data transfer, traffic stays within its region of origin whenever the network can accommodate it — automatically, with no API changes.

Explicit regional pinning and routing overrides remain available through the API for workloads that need them.

---

## Function and tool calling in the SDKs

Tool and function calls are now supported across both the JavaScript and Python SDKs. The interface follows the same shape as the OpenAI chat completions API.

Pass a `tools` array in your request. When the model decides to invoke a function, the response includes a structured `tool_calls` object. Your application executes the call, returns the result as a `tool` role message, and the model continues from there. The loop is clean, predictable, and compatible with tool-calling integrations you may already have built against other providers.

This is the foundation for building agents and tool-using applications directly on PolarGrid — with the latency profile of edge inference rather than centralized cloud APIs.

---

## Voice cold starts eliminated

Every voice session previously incurred a cold start: the pipeline had to allocate resources, initialize the session, and warm up before the first audio exchange could begin. That overhead is gone.

A warm-session pool is now active across the voice pipeline. When a call comes in, it connects to a pre-warmed session rather than initializing one from scratch. The result is a direct, measurable improvement to the responsiveness users feel at the start of every call — particularly important for voice agents where a multi-second delay before the first response breaks the conversational flow.

---

## First customer voice agent live

A real-time consulting-triage voice agent is now running in production for Digital Treehouse. This is the first end-to-end customer deployment on the PolarGrid voice stack — a live application handling real conversations with real users.

The deployment validates the full voice pipeline under production conditions: STT, LLM, and TTS chained together on PolarGrid edge infrastructure, serving a concrete customer use case. It's also a meaningful proof point for any team evaluating whether the platform can support their own voice agent requirements.

---

*$500 in free credits. No card required. Sub-400ms voice pipeline live now.*
[**Start Free →**](https://app.polargrid.ai)
