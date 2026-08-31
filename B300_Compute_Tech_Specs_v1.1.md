# B300 COMPUTE Technical Specification and Acceptance Requirements
**Version 1.1 — July 18, 2026**

This document defines the hardware, facility, telemetry, and acceptance-testing requirements for NVIDIA HGX B300 bare-metal and dedicated-cluster capacity. Proposals and quotations should be prepared against the requirements below. Commercial terms, service levels, and support commitments are addressed separately.

---

## 1. Purpose and Interpretation

**1.1** This document standardizes (a) the hardware Customer will accept as "B300-class" compute, using objective, testable criteria, and (b) the definition of Intended Performance and the acceptance process used to verify it.

**1.2** All references to "NVIDIA published specification" mean the NVIDIA datasheet and reference architecture documents for the exact platform and SKU delivered, as current at Service Order execution, attached to the Service Order as a fixed reference (see Appendix A). Provider may not substitute lower-binned, reduced-TDP, deprecated, or non-NVIDIA-certified variants.

---

## 2. Standard Hardware Specification (Objective Criteria)

### 2.1 Approved Platform Configuration

| Parameter | HGX B300 |
|---|---|
| **System** | NVIDIA-Certified 8-GPU HGX B300 baseboard system from a Tier-1 OEM (e.g., Supermicro, Dell, HPE, Lenovo, Quanta, Wiwynn) |
| **GPUs** | 8× NVIDIA B300 (Blackwell Ultra) SXM per node |
| **GPU memory** | 288 GB HBM3e per GPU; ≥ 2.3 TB per node |
| **Scale-up fabric** | NVLink 5 fully connected via NVSwitch; 1.8 TB/s bidirectional per GPU |
| **GPU TDP** | Configured at full 1,100 W per GPU — no factory or operator power cap below NVIDIA maximum |
| **Cooling** | Air or DLC per OEM design; must sustain full TDP with zero thermal throttling at rated ambient |

### 2.2 Node / Host Minimums

| Component | Minimum Requirement |
|---|---|
| **CPU** | 2× current-generation x86 server CPUs (Intel Xeon 6 or AMD equivalent), ≥ 96 physical cores per node total |
| **System memory** | ≥ 3 TB DDR5, all channels populated and balanced (channel imbalance test at acceptance) |
| **Local NVMe** | ≥ 30 TB usable data-plane NVMe (PCIe Gen5) plus redundant (RAID-1) boot devices; enterprise endurance ≥ 1 DWPD |
| **East-West NIC** | 8× NVIDIA ConnectX-8 SuperNIC, 800 Gb/s per GPU (6.4 Tb/s per node; 1:1 GPU:NIC rail mapping per NVIDIA RA) |
| **North-South / DPU** | ≥ 2× 400 Gb/s via NVIDIA BlueField-3 (or CX-7/CX-8), isolated from the E-W compute fabric |
| **PCIe** | Gen5 minimum end-to-end to all GPUs and NICs; no switch oversubscription off the reference design |
| **Management** | Dedicated BMC (Redfish/IPMI) on out-of-band network; Customer read access to BMC telemetry |

### 2.3 Cluster Network Fabric

- **Reference architecture.** Topology per the NVIDIA Cloud Partner / Enterprise Reference Architecture for the delivered platform (or an equivalent rail-optimized leaf-spine design), with each GPU rail mapped to a dedicated leaf group.
- **Blocking ratio.** Non-blocking (1:1) within each Scalable Unit (SU); oversubscription between SUs and spine no worse than the NVIDIA RA for the quoted cluster size, and never worse than 2:1. SU size and full topology (including cabling maps) delivered as part of the acceptance package.
- **Fabric.** NVIDIA Spectrum-X Ethernet (SN5600/SN5610-class, 800 GbE) with RoCEv2, adaptive routing, and congestion control enabled and attested; or NVIDIA Quantum-X800 InfiniBand. Mixed or third-party fabrics require prior written approval.
- **Storage fabric.** Dedicated storage fabric ≥ 2× 400 Gb/s per node, physically or logically isolated from the E-W compute fabric so storage traffic cannot degrade collective operations.
- **Management.** Separate in-band management network (≥ 100 GbE) and 1 GbE out-of-band; PTP time sync across the cluster.
- **Cabling.** All optics/DAC per the switch vendor's qualified compatibility list; BERT results for every E-W link included in the acceptance package; per-port mapping documentation maintained.

### 2.4 Facility and Environment

- Data center rated Tier III or better (concurrently maintainable); N+1 power path and cooling (including CDUs for liquid-cooled deployments).
- Provisioned power ≥ 110% of the maximum theoretical IT load of the delivered cluster at full GPU TDP. Power capping, load shedding, or demand-response curtailment of Customer capacity is prohibited.
- Facility coolant supply temperature and flow (liquid) and inlet air (ASHRAE A1) within the OEM/NVIDIA operating specification at all rack positions, evidenced by continuous telemetry.

### 2.5 Hardware Provenance and Fleet Uniformity

- All GPUs, baseboards, and systems new, OEM-sourced through authorized channel, manufactured within 12 months of delivery; no refurbished units, engineering samples, or gray-market parts. Full serial-number manifest (GPU UUID, baseboard, chassis, NIC) delivered at acceptance and updated on every swap.
- Fleet uniformity: identical SKU, VBIOS, firmware, and driver baseline across all nodes of the cluster; firmware per the NVIDIA-qualified matrix, with change control and rollback.
- Spares are additive: the contracted GPU count excludes warm spares and Spare Pool inventory. On-site FRU spares ≥ 3% per component class and ≥ 2 warm-spare nodes per SU (or per 32 nodes), at Provider cost. A warm spare substituting for a failed node does not count as delivered capacity twice.

### 2.6 Software, Telemetry, and Access Baseline

- Bare-metal root access; PXE-provisionable golden images; NVIDIA driver branch and CUDA version pinned by Customer within the NVIDIA support matrix.
- DCGM 4.x metrics (per-GPU clocks, HBM bandwidth counters, ECC counters, throttle reasons, power draw, temperatures, NVLink CRC/replay counters) exported to Customer in real time (Prometheus-compatible endpoint), with ≥ 13 months retention. This telemetry stream is the primary performance measurement record, and Customer's copy is authoritative if Provider's is unavailable.
- Fabric telemetry: per-port link state, negotiated speed, error/discard counters, PFC pause and ECN statistics visible to Customer read-only.

---

## 3. Intended Performance — Definition and Acceptance (IRA)

"Intended Performance" is defined per node and per cluster as the HIGHER of:

- **(a)** the contractual floors in Table 3.1, and
- **(b)** 97% of that node's / cluster's own recorded Reference Performance Baseline (RPB).

The RPB is recorded during Initial Readiness Acceptance using the tests below, is delivered to Customer in raw-log form, and may only be re-baselined downward with Customer's written consent.

### 3.1 Acceptance Thresholds (Contractual Floors)

| Test (NVIDIA-standard tooling) | Scope | Pass Threshold |
|---|---|---|
| DCGM diagnostics Level 4 (extended stress) | Every GPU / node | Pass, zero warnings on ECC, thermals, NVLink, PCIe |
| HPL-MxP / HPL-AI | Every node | ≥ 95% of NVIDIA published reference for the platform, AND ≥ 97% of the cluster fleet median |
| HBM bandwidth (STREAM triad, GPU) | Every GPU | ≥ 95% of 8 TB/s published spec (≥ 7.6 TB/s) |
| NVLink peer-to-peer sweep (all GPU pairs) | Every node | ≥ 95% of 1.8 TB/s bidirectional per GPU; no asymmetric links |
| NCCL all-reduce / all-gather / reduce-scatter | Node, paired-node, per-SU, full cluster | Bus bandwidth ≥ 95% of the NVIDIA reference result for the platform and message-size sweep; full-cluster busbw ≥ 90% of single-SU busbw (scaling efficiency) |
| Per-link RDMA throughput (ib_write_bw / perftest) | Every E-W link | ≥ 95% of 800 Gb/s line rate (≥ 760 Gb/s effective) |
| Sustained stress burn-in (GPU-Burn or NVIDIA-approved equivalent, 72 h) | Every node | Zero uncorrectable ECC, zero thermal throttle events, zero NVLink CRC escalation, zero node reboot/PSU trip |
| Host memory (STREAM CPU) | Every node | Within OEM spec; no channel imbalance |
| Storage fabric I/O (IOR), where storage in scope | Per SU and cluster | ≥ contracted aggregate throughput |

### 3.2 Acceptance Process

- Provider runs the full Section 3.1 suite and delivers an acceptance package: raw benchmark logs, DCGM reports, serial manifest, topology and cabling maps, BERT results, and firmware manifest. Summary-only packages are not acceptable.
- Customer has 10 business days of customer burn-in with full access to re-run any test. Nodes failing any floor are rejected, replaced from spares, and re-tested; billing does not commence, and no milestone payment becomes due, for affected capacity until it passes.
- Fleet-median rule prevents "bad-tail" deliveries: if more than 5% of nodes fail the 97%-of-median test, Customer may reject the delivery tranche as a whole.
- The accepted results constitute the RPB and are incorporated into the Service Order. Re-validation runs quarterly (scheduled, ≤ 8 h per quarter, with at least 10 days' advance notice) and after any firmware/driver change, hardware swap, or reported degradation.

---

## Appendix A — NVIDIA Published Reference Values (fix at signing)

Confirm against the then-current NVIDIA datasheet for the delivered SKU and attach to the Service Order. Values below are the reference points as of July 2026:

| Parameter | HGX B300 (per GPU / per node) |
|---|---|
| **GPU** | B300 (Blackwell Ultra) SXM |
| **HBM3e capacity** | 288 GB / 2.3 TB |
| **HBM bandwidth** | 8 TB/s per GPU |
| **NVLink 5** | 1.8 TB/s bidirectional per GPU |
| **FP4 Tensor (dense, per GPU)** | ≈ 15 PFLOPS (NVFP4) |
| **FP8 Tensor (dense, per GPU)** | ≈ 7 PFLOPS |
