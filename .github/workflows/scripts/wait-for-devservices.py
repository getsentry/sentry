#!/usr/bin/env python3
"""Log container health after devservices up.

Usage: wait-for-devservices.py
"""

from __future__ import annotations

import json
import subprocess


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


if __name__ == "__main__":
    container_inspect_dump()
