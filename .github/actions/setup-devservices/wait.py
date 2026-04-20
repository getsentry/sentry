#!/usr/bin/env python3
"""Wait for the background devservices process started by the setup-devservices action.

Usage: wait.py [timeout_seconds]

Reads:  /tmp/ds-exit, /tmp/ds.log  (written by the setup-devservices action)
Writes: $GITHUB_ENV  (DJANGO_LIVE_TEST_SERVER_ADDRESS)
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

DS_EXIT = Path("/tmp/ds-exit")
DS_LOG = Path("/tmp/ds.log")
TIMEOUT = 300


def log(msg: str) -> None:
    print(msg, flush=True)


def docker(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["docker", *args], capture_output=True, text=True)


def stream_log(pos: int) -> int:
    """Print any new content written to DS_LOG since pos. Returns the new position."""
    if not DS_LOG.exists():
        return pos
    with DS_LOG.open() as f:
        f.seek(pos)
        chunk = f.read()
        if chunk:
            sys.stdout.write(chunk)
            sys.stdout.flush()
        return f.tell()


def container_inspect_dump() -> None:
    ids = docker("ps", "-aq").stdout.split()
    if not ids:
        return

    r = docker("inspect", *ids)
    if r.returncode != 0:
        return

    containers = json.loads(r.stdout)
    for c in containers:
        name = c["Name"].lstrip("/")
        status = c["State"]["Status"]
        health = c["State"].get("Health")
        health_status = health["Status"] if health else "n/a"
        log(f"{name}  status={status}  health={health_status}")

    log("")
    for c in containers:
        health = c["State"].get("Health")
        if not health or health["Status"] == "healthy":
            continue
        name = c["Name"].lstrip("/")
        log(f"--- {name} last health check ---")
        for entry in health.get("Log", []):
            log(f"  exit={entry['ExitCode']}  {entry['Output'].strip()}")


def wait(timeout: int = TIMEOUT) -> None:
    start = time.monotonic()
    log_pos = 0

    while not DS_EXIT.exists():
        elapsed = time.monotonic() - start
        if elapsed > timeout:
            log_pos = stream_log(log_pos)
            log(f"::error::Timed out waiting for devservices after {timeout}s")
            log("--- container health on timeout ---")
            container_inspect_dump()
            sys.exit(1)
        log_pos = stream_log(log_pos)
        time.sleep(2)

    # Drain any remaining log output.
    stream_log(log_pos)

    rc = int(DS_EXIT.read_text().strip())
    if rc != 0:
        log(f"::error::devservices up failed (exit {rc})")
        log("--- container health on failure ---")
        container_inspect_dump()
        sys.exit(1)

    r = docker(
        "network",
        "inspect",
        "bridge",
        "--format",
        "{{(index .IPAM.Config 0).Gateway}}",
    )
    if r.returncode != 0:
        log(f"::error::docker network inspect bridge failed: {r.stderr.strip()}")
        sys.exit(1)
    gateway = r.stdout.strip()
    github_env = os.environ.get("GITHUB_ENV")
    if github_env:
        with open(github_env, "a") as f:
            f.write(f"DJANGO_LIVE_TEST_SERVER_ADDRESS={gateway}\n")

    r2 = docker("ps", "-a")
    if r2.stdout.strip():
        log(r2.stdout.strip())


if __name__ == "__main__":
    wait(int(sys.argv[1]) if len(sys.argv) > 1 else TIMEOUT)
