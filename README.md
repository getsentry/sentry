# Sentry – Developer‑first Error Tracking & Performance Monitoring  

[![GitHub stars](https://img.shields.io/github/stars/getsentry/sentry?style=flat)](https://github.com/getsentry/sentry/stargazers)  
[![GitHub forks](https://img.shields.io/github/forks/getsentry/sentry?style=flat)](https://github.com/getsentry/sentry/network)  
[![License – FSL](https://img.shields.io/github/license/getsentry/sentry?style=flat)](https://github.com/getsentry/sentry/blob/master/LICENSE)  
[![GitHub Workflow Status (CI)](https://img.shields.io/github/actions/workflow/status/getsentry/sentry/self-hosted.yml?branch=master&label=CI&style=flat)](https://github.com/getsentry/sentry/actions)  
[![Coverage Status](https://coveralls.io/repos/github/getsentry/sentry/badge.svg?branch=master)](https://coveralls.io/github/getsentry/sentry?branch=master)  
[![Latest release](https://img.shields.io/github/v/tag/getsentry/sentry?label=release&style=flat)](https://github.com/getsentry/sentry/releases/latest)

---  

## Table of Contents  

- [Overview](#overview)  
- [Key Features](#key-features)  
- [Quick‑Start (Docker Compose)](#quick-start-docker-compose)  
- [Installation Options](#installation-options)  
- [Configuration & Tuning](#configuration--tuning)  
- [Official SDKs](#official-sdks)  
- [Documentation & Resources](#documentation--resources)  
- [Community & Support](#community--support)  
- [Contributing](#contributing)  
- [License](#license)  
- [Code of Conduct](#code-of-conduct)  

---  

## Overview  

Sentry is a **developer‑first error tracking and performance‑monitoring platform** that helps developers see what actually matters, fix issues faster, and learn continuously from their applications.  

It powers the hosted service at **sentry.io** and the open‑source self‑hosted distribution.

---  

## Key Features  

- **Error Tracking** – real‑time crash reports with full stack traces.  
- **Performance Monitoring (APM)** – detailed transaction tracing and latency breakdowns.  
- **Session Replay** – replay exactly what users saw when the error happened.  
- **Logs Integration** – collect and analyze logs in context with events.  
- **Cron & Job Monitoring** – detect failures in scheduled jobs.  
- **Profiling** – CPU‑time profiling for hot‑path analysis.  
- **Uptime & Heartbeat Checks** – monitor service availability.  
- **AI‑assisted insights** (Seer) – intelligent anomaly detection (SaaS only).  

---  

## Quick‑Start (Docker Compose)  

The **self‑hosted** distribution ships a single‑node Docker Compose stack.  
From the official self‑hosted docs:

1. Clone the latest self‑hosted release.  
2. Run the installer, which creates a baseline configuration.  
3. Bring the stack up with Docker Compose.  

```bash
# 1️⃣ Clone the repo (latest release)
VERSION=$(curl -Ls -o /dev/null -w %{url_effective} \
  https://github.com/getsentry/self-hosted/releases/latest)
VERSION=${VERSION##*/}

git clone https://github.com/getsentry/self-hosted.git
cd self-hosted
git checkout ${VERSION}

# 2️⃣ Run the installer (interactive)
./install.sh

# 3️⃣ Start Sentry (default HTTP port 9000)
docker compose up --wait
```

After the installer finishes you can reach the UI at <http://127.0.0.1:9000>.  

> **Minimum hardware** – 20 GB free disk, 16 GB RAM + 16 GB swap, 4 CPU cores.  

---  

## Installation Options  

| Method | When to use | Links |
|--------|--------------|-------|
| **Docker Compose (single‑node)** | Development, POCs, low‑volume workloads | <https://develop.sentry.dev/self-hosted> |
| **Helm chart (Kubernetes)** | Production clusters, scaling, cloud‑native environments | <https://github.com/sentry-kubernetes/charts> |
| **GitHub Container Registry image** | Custom container runtimes, CI pipelines | `ghcr.io/getsentry/sentry` |
| **Air‑gapped installations** | Environments without internet access (see proxy & “air‑gap” sections) | <https://develop.sentry.dev/self-hosted#air-gapped-installation> |

All methods share the same `install.sh` script for initial configuration and upgrades.  

---  

## Configuration & Tuning  

Configuration lives in **`config.yml`** (system‑wide) and **`sentry.conf.py`** (Python settings).  

* Update the public URL after you put a load balancer in front of Sentry:  

  ```yaml
  # config.yml
  system.url-prefix: "https://sentry.example.com"
  ```  


* Enable/disable the optional beacon (anonymous usage stats) in `sentry.conf.py`:  

  ```python
  SENTRY_BEACON = False
  ```  

* For high‑traffic deployments you’ll want dedicated databases (PostgreSQL, ClickHouse), a Kafka cluster, and caching (Redis, Memcached). See the **Reference Architectures** section for multi‑node diagrams.  

* Proxy support – set Docker daemon proxy variables and re‑load Docker if your network requires an HTTP proxy.  

---  

## Official SDKs  

Sentry provides first‑party SDKs for every major language and framework. Each SDK lives in its own repository; the table below links directly to the official repos.

| Language / Platform | SDK Repo |
|----------------------|----------|
| JavaScript (browser & Node) | <https://github.com/getsentry/sentry-javascript> |
| Electron | <https://github.com/getsentry/sentry-electron> |
| React‑Native | <https://github.com/getsentry/sentry-react-native> |
| Python | <https://github.com/getsentry/sentry-python> |
| Ruby | <https://github.com/getsentry/sentry-ruby> |
| PHP | <https://github.com/getsentry/sentry-php> |
| Laravel | <https://github.com/getsentry/sentry-laravel> |
| Go | <https://github.com/getsentry/sentry-go> |
| Rust | <https://github.com/getsentry/sentry-rust> |
| Java / Kotlin | <https://github.com/getsentry/sentry-java> |
| Objective‑C / Swift | <https://github.com/getsentry/sentry-cocoa> |
| .NET (C# / F#) | <https://github.com/getsentry/sentry-dotnet> |
| C / C++ (Native) | <https://github.com/getsentry/sentry-native> |
| Dart / Flutter | <https://github.com/getsentry/sentry-dart> |
| Perl | <https://github.com/getsentry/perl-raven> |
| Clojure | <https://github.com/getsentry/sentry-clj> |
| Elixir | <https://github.com/getsentry/sentry-elixir> |
| Unity | <https://github.com/getsentry/sentry-unity> |
| Unreal Engine | <https://github.com/getsentry/sentry-unreal> |
| Godot Engine | <https://github.com/getsentry/sentry-godot> |
| PowerShell | <https://github.com/getsentry/sentry-powershell> |

A full list of supported platforms lives on the **Platforms** page: <https://docs.sentry.io/platforms/>.  

---  

## Documentation & Resources  

| Resource | Link |
|----------|------|
| **Documentation** | <https://docs.sentry.io/> |
| **Self‑hosted guide** | <https://develop.sentry.dev/self-hosted> |
| **API reference** | <https://docs.sentry.io/api/> |
| **Discussions / Q&A** | <https://github.com/getsentry/sentry/discussions> |
| **Discord community** | <https://discord.gg/PXa5Apfe7K> |
| **Bug tracker** | <https://github.com/getsentry/sentry/issues> |
| **Translation (Transifex)** | <https://explore.transifex.com/getsentry/sentry/> |
| **Contributing guide** | <https://docs.sentry.io/internal/contributing/> |

---  

## Community & Support  

- **Discord** – the primary place for real‑time help and community chat.  
- **GitHub Discussions** – for feature ideas, usage questions, and troubleshooting.  
- **GitHub Issues** – report bugs or request enhancements.  
- **Sentry Cloud (saas)** – commercial support plans are available at <https://sentry.io/pricing/>.  

---  

## Contributing  

We welcome contributions!  

- **Read the contribution guidelines** – see the internal docs page for policies and recommended workflow.  
- Follow the **code of conduct** when interacting with the community【54†L743-L749】 (full text in the global repo: <https://github.com/getsentry/.github/blob/main/CODE_OF_CONDUCT.md>).  
- Fork the repository, make your changes, and submit a Pull Request.  
- For large changes, open a discussion first on the issues tracker.  

---  

## License  

Sentry is released under the **Fair Source License (FSL)** – a source‑available license that becomes Apache 2.0 after two years and restricts commercial competition with Sentry itself.  

---  

## Code of Conduct  

Please read and follow our community Code of Conduct: <https://github.com/getsentry/.github/blob/main/CODE_OF_CONDUCT.md>.  

---  

## Screenshots  

A quick visual tour of the UI:

| Issue Details | Session Replay | Trace Explorer |
|---|---|---|
| <img src="https://raw.githubusercontent.com/getsentry/sentry/master/.github/screenshots/issue-details.png" alt="Issue details" width="300"/> | <img src="https://raw.githubusercontent.com/getsentry/sentry/master/.github/screenshots/replays.png" alt="Session replay" width="300"/> | <img src="https://raw.githubusercontent.com/getsentry/sentry/master/.github/screenshots/traces.png" alt="Traces" width="300"/> |
