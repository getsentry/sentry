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
import subprocess
import sys
import time
import tomllib  # the runner's system python3 is 3.12
from pathlib import Path

STATE_DIR = Path(os.environ["RUNNER_TEMP"]) / "devservices-ci"
LOG_FILE = STATE_DIR / "up.log"
EXIT_FILE = STATE_DIR / "up.exit"
TIMEOUT = float(os.environ.get("DEVSERVICES_TIMEOUT", "10")) * 60


def devservices_up_cmd() -> list[str]:
    with open(os.environ["DEVSERVICES_LOCKFILE"], "rb") as f:
        (pkg,) = [p for p in tomllib.load(f)["package"] if p["name"] == "devservices"]
    # --python: the system python, so uv doesn't download .python-version's.
    # --default-index: the lockfile's index (getsentry has no uv index config).
    return [
        "uv", "run", "--no-project", "--python", "python3",
        "--default-index", pkg["source"]["registry"],
        "--with", f"devservices=={pkg['version']}",
        "--", "devservices", "up", "--mode", os.environ["DEVSERVICES_MODE"],
    ]  # fmt: skip


def start() -> None:
    cmd = devservices_up_cmd()
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Running in the background (log: {LOG_FILE}): {' '.join(cmd)}")
    # A new session, so it outlives this step.
    with open(LOG_FILE, "w") as log:
        subprocess.Popen(
            [sys.executable, __file__, "run", *cmd],
            stdin=subprocess.DEVNULL,
            stdout=log,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )


def run(cmd: list[str]) -> None:
    rc = 1  # if anything raises, the traceback goes to the log and this is recorded
    try:
        rc = subprocess.run(cmd, cwd=os.environ.get("DEVSERVICES_WORKDIR")).returncode
    finally:
        # Write-then-rename, so readers never see a partial file.
        tmp = EXIT_FILE.with_suffix(".tmp")
        tmp.write_text(f"{rc}\n")
        tmp.replace(EXIT_FILE)


def wait() -> int:
    deadline = time.monotonic() + TIMEOUT
    while not EXIT_FILE.exists() and time.monotonic() < deadline:
        time.sleep(1)
    print(LOG_FILE.read_text(errors="replace"))
    if not EXIT_FILE.exists():
        print(f"::error::devservices up timed out after {TIMEOUT:.0f}s")
        return 124
    rc = int(EXIT_FILE.read_text())
    if rc != 0:
        print(f"::error::devservices up failed (exit {rc})")
    return rc


if __name__ == "__main__":
    match sys.argv[1:]:
        case ["start"]:
            start()
        case ["run", *cmd]:
            run(cmd)
        case ["wait"]:
            sys.exit(wait())
        case _:
            sys.exit(f"usage: {sys.argv[0]} start|wait")
