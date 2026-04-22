#!/usr/bin/env python3
"""Log container health after devservices up and set DJANGO_LIVE_TEST_SERVER_ADDRESS.

Usage: wait-for-devservices.py

Writes: $GITHUB_ENV  (DJANGO_LIVE_TEST_SERVER_ADDRESS)
"""

from __future__ import annotations

import json
import os
import subprocess
import sys


def log(msg: str) -> None:
    print(msg, flush=True)


def docker(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["docker", *args], capture_output=True, text=True)


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


def run() -> None:
    container_inspect_dump()

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


if __name__ == "__main__":
    run()
