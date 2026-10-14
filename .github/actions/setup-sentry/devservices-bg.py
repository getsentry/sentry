#!/usr/bin/env python3
"""Run `devservices up` in the background, so image pulls and health checks
overlap the rest of the CI setup.

  devservices-bg.py start  Start `devservices up --mode $DEVSERVICES_MODE` in the
                           background via `uv run`, with the devservices version
                           pinned in $DEVSERVICES_LOCKFILE. No sentry venv needed.
  devservices-bg.py wait   Wait for it, print its output and exit with its status.

The exit status goes to $RUNNER_TEMP/devservices-ci/up.exit, which
bootstrap-snuba.py also watches (DEVSERVICES_STATUS_FILE).

Stdlib only. Kept in sync with getsentry's
.github/actions/start-devservices/devservices-bg.py.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
import tomllib  # python >= 3.11; the runner's system python3 is 3.12
import traceback
from pathlib import Path

STATE_DIR = Path(os.environ["RUNNER_TEMP"]) / "devservices-ci"
LOG_FILE = STATE_DIR / "up.log"
EXIT_FILE = STATE_DIR / "up.exit"
TIMEOUT = float(os.environ.get("DEVSERVICES_TIMEOUT", "10")) * 60


def uv_run_devservices() -> list[str]:
    with open(os.environ["DEVSERVICES_LOCKFILE"], "rb") as f:
        pkgs = [p for p in tomllib.load(f)["package"] if p["name"] == "devservices"]
    if len(pkgs) != 1:
        raise SystemExit(
            f"::error::expected one devservices package in the lockfile, found {len(pkgs)}"
        )
    (pkg,) = pkgs
    # --python: the system python, so uv doesn't download .python-version's.
    # --default-index: the lockfile's index (getsentry has no uv index config).
    return [
        "uv", "run", "--no-project", "--python", "python3",
        "--default-index", pkg["source"]["registry"],
        "--with", f"devservices=={pkg['version']}",
        "--", "devservices", "up", "--mode", os.environ["DEVSERVICES_MODE"],
    ]  # fmt: skip


def start() -> None:
    cmd = uv_run_devservices()
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Running in the background (log: {LOG_FILE}): {' '.join(cmd)}", flush=True)
    if os.fork():
        return

    # Child: detach from the step, so it keeps running after the step exits.
    os.setsid()
    with open(os.devnull) as devnull, open(LOG_FILE, "w") as log:
        os.dup2(devnull.fileno(), 0)
        os.dup2(log.fileno(), 1)
        os.dup2(log.fileno(), 2)
    rc = 1
    try:
        # Own process group, so a timeout also kills devservices and compose.
        proc = subprocess.Popen(
            cmd, cwd=os.environ.get("DEVSERVICES_WORKDIR", "."), process_group=0
        )
        try:
            rc = proc.wait(timeout=TIMEOUT)
        except subprocess.TimeoutExpired:
            print(f"::error::devservices up timed out after {TIMEOUT:.0f}s", flush=True)
            os.killpg(proc.pid, signal.SIGKILL)
            proc.wait()
            rc = 124
    except BaseException:
        traceback.print_exc()
    finally:
        tmp = EXIT_FILE.with_suffix(".tmp")
        tmp.write_text(f"{rc}\n")
        tmp.replace(EXIT_FILE)
        os._exit(0)


def wait() -> int:
    deadline = time.monotonic() + TIMEOUT + 60  # backstop; start's timeout fires first
    while not EXIT_FILE.exists():
        if time.monotonic() > deadline:
            print(LOG_FILE.read_text(errors="replace"), flush=True)
            print("::error::Timed out waiting for devservices up", flush=True)
            return 124
        time.sleep(1)
    print(LOG_FILE.read_text(errors="replace"), flush=True)
    rc = int(EXIT_FILE.read_text())
    if rc != 0:
        print(f"::error::devservices up failed (exit {rc})", flush=True)
    return rc


if __name__ == "__main__":
    if sys.argv[1:] == ["start"]:
        start()
    elif sys.argv[1:] == ["wait"]:
        sys.exit(wait())
    else:
        sys.exit(f"usage: {sys.argv[0]} start|wait")
