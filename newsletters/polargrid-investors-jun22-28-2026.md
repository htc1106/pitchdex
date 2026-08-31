# Newsletter Draft — Investors | June 22–28, 2026

---

**PolarGrid Weekly Update**
*Week of June 22–28, 2026*

---

Hey team,

Busy week — app is live, first real customer prospect in motion, and hardware inbound. Here's the full picture.

---

## 🚀 Product: Web App Live

The PolarGrid platform app went live this week at [main.d1btitjthusyzk.amplifyapp.com](https://main.d1btitjthusyzk.amplifyapp.com/auth). Dylan shared the link with the team for initial feedback, and internal review sessions kicked off across product, design, and leadership.

Active work this week included:
- **Org system design proposal** finalized by Dylan — covers how users create workspaces, invite team members, and manage multi-org scenarios. Key decisions: every user gets an automatic personal workspace on signup (no friction), a clean 3-role model (Owner / Admin / Member), and an org switcher for users in multiple teams. Full proposal [here](https://docs.google.com/document/d/13y0Gnj9K1_SNXKAOcSgG6qMbYPB6h-KmE1L8pFCIJoM/edit?usp=sharing).
- Feedback rounds from Kelly and Rade on onboarding UX, navigation, and org architecture. Consensus moving toward 1:1 user-to-org with auto-populated org names (rather than optional personal accounts).
- Navigation bug flagged (team/projects/billing pages returning users to overview) — Dylan confirmed in progress.

---

## 🤝 Customer Pipeline: Fitting Room

This week's most significant development: a customer meeting with a **deep tech virtual try-on company** building a fitting room application for e-commerce. Sev led the technical scoping. Highlights:

**Their stack (currently on AWS):**
- Custom AI model inference on A10 GPUs
- 3D avatar processing with custom KUDO kernels (5× more compute than model inference)
- GPU-accelerated physics simulation for clothes modeling
- L40-based rendering pipeline — 6 seconds per frame, 12GB GPU memory per process, dozens of GPUs per user session

**Their problem:**
- AWS costs are prohibitive — they need a **5× cost reduction**
- Kubernetes/Docker deployment, 9 inference endpoints + separate rendering endpoints
- 15-second max inference target per virtual try-on session
- **Decision driver: price, not latency**

**Next steps from PolarGrid:**
1. Deployment documentation and integration architecture guide
2. Endpoint specifications (parameters, env vars, architecture)
3. Compute optimization analysis — which workloads map best to our platform

This is a meaningful early customer if we can deliver on cost. Sev has notes [here](https://docs.google.com/document/d/1QaS9UqjOWzEgwmxl1FIlGCapwkq7sH8OkNkuX1gwcHU/edit?usp=sharing).

---

## 🔧 Hardware

Servers are shipping — **ETA: July 15th to Sev's location.** 🎉

This marks the transition from cloud-only ops to first owned compute. Timeline aligns with the POC work in progress for the fitting room prospect.

---

## 📌 What's Next

- Complete org system design decisions (billing model, multi-org final call)
- Deliver customer documentation package for the fitting room POC
- Hardware receipt and setup (July 15)
- Continue internal app feedback loop

---

*Compiled from Slack channels: #all-polargrid, #product, #customer-meetings, #hardware — week of June 22–28, 2026.*
