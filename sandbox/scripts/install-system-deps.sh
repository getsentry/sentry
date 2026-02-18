#!/usr/bin/env bash
set -euo pipefail

# Runs as root. Installs all system-level dependencies for the Sentry sandbox.
# Version pins come from devenv/config.ini (node, uv) and package.json (pnpm).

PYTHON_VERSION="3.13.1"
NODE_VERSION="v22.16.0"
UV_VERSION="0.9.28"
PNPM_VERSION="10.10.0"

export DEBIAN_FRONTEND=noninteractive

###############################################################################
# Base packages
###############################################################################
apt-get update
apt-get install -y --no-install-recommends \
    apt-transport-https \
    ca-certificates \
    curl \
    git \
    gnupg \
    lsb-release \
    make \
    build-essential \
    pkg-config \
    libssl-dev \
    libffi-dev \
    postgresql-client \
    redis-tools \
    direnv \
    jq

###############################################################################
# Docker CE (official repo)
###############################################################################
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable docker
systemctl start docker

###############################################################################
# Node.js (from Sentry's pinned assets, same source as devenv/config.ini)
###############################################################################
NODE_URL="https://storage.googleapis.com/sentry-dev-infra-assets/node/node-${NODE_VERSION}-linux-x64.tar.xz"
curl -fsSL "$NODE_URL" | tar -xJ -C /usr/local --strip-components=1

###############################################################################
# ChromeDriver (required by sentry .envrc, snap package broken on Ubuntu 24.04)
###############################################################################
npm install -g chromedriver

###############################################################################
# uv (pinned)
###############################################################################
curl -LsSf "https://astral.sh/uv/${UV_VERSION}/install.sh" | env INSTALLER_NO_MODIFY_PATH=1 sh -s -- --no-modify-path
cp /root/.local/bin/uv /usr/local/bin/uv
cp /root/.local/bin/uvx /usr/local/bin/uvx

###############################################################################
# Python 3.13.1 (via uv)
###############################################################################
uv python install "$PYTHON_VERSION"

###############################################################################
# pnpm (pinned, via corepack)
###############################################################################
corepack enable
corepack prepare "pnpm@${PNPM_VERSION}" --activate

###############################################################################
# System tuning for file watchers
###############################################################################
cat >> /etc/sysctl.d/99-sentry-sandbox.conf <<'SYSCTL'
fs.inotify.max_user_watches=524288
fs.inotify.max_user_instances=256
SYSCTL
sysctl --system

echo "=== install-system-deps.sh complete ==="
