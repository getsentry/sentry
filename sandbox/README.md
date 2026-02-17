# Sentry GCE Sandbox Image

Packer pipeline that produces a GCE machine image with a fully working Sentry dev environment. Cold start goes from 5-10 minutes to 30-90 seconds.

## What's in the image

- System deps: Docker CE, Python 3.13.1, Node v22.16.0, uv 0.9.28, pnpm 10.10.0
- Sentry repo cloned to `/opt/sentry` with Python and JS deps installed
- Pre-commit hooks downloaded
- Docker service images pre-pulled
- Databases created, migrations applied, superuser seeded (`admin@sentry.io` / `admin`)
- Systemd units for startup and devserver

## How it works

The core setup uses `devenv sync` — the same canonical path every Sentry developer uses locally. The build scripts just install system-level prerequisites (Docker, Python, etc.) and then let devenv handle the rest.

Systemd services handle boot:

- `sandbox-startup.service` — reads GCE metadata for branch/mode, starts devservices
- `sandbox-devserver.service` — runs `devservices serve` after startup completes

## Prerequisites

One-time GCP setup:

```bash
gcloud services enable compute.googleapis.com --project=hubert-test-project
```

Local requirements:

- `gcloud auth application-default login`
- `gcloud config set project hubert-test-project`
- Packer installed (`brew install packer`)

## Build

```bash
cd sandbox/packer
packer init sandbox.pkr.hcl
packer build sandbox.pkr.hcl
```

Packer creates a temporary GCE VM, SSHs in, runs all provisioners, snapshots the disk, and deletes the build VM.

## Verify

```bash
# Check the image was created
gcloud compute images list --project=hubert-test-project --filter="family=sentry-sandbox"

# Create a test VM
gcloud compute instances create sandbox-test \
  --project=hubert-test-project \
  --zone=us-central1-a \
  --machine-type=e2-standard-8 \
  --image-family=sentry-sandbox \
  --image-project=hubert-test-project

# SSH in and check
gcloud compute ssh sandbox-test --zone=us-central1-a
cat /tmp/sandbox-ready
curl localhost:8000/auth/login/
```

## Version pinning

Tool versions come from the same sources used by local dev:

- `devenv/config.ini` — Node, uv
- `package.json` `packageManager` field — pnpm
- Python version matches what's in the venv

## File overview

```
sandbox/
├── packer/
│   └── sandbox.pkr.hcl          # Packer template
├── scripts/
│   ├── install-system-deps.sh    # Docker, Python, Node, uv, pnpm, devenv
│   ├── run-devenv-sync.sh        # devenv sync + stop containers for snapshot
│   ├── pull-service-images.sh    # Pre-pull Docker images from devservices/config.yml
│   ├── install-ide-support.sh    # Claude Code
│   └── optimize-image.sh         # Shrink image
├── systemd/
│   ├── sandbox-startup.service   # Boot: read metadata, checkout branch, start services
│   └── sandbox-devserver.service # Run devservices serve
├── startup.sh                    # Called by sandbox-startup.service
└── README.md
```
