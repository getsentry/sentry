#!/usr/bin/env python3
"""Run `devservices up` for CI, optionally in the background.

Starting it in the background lets image pulls and container health checks
overlap the Python environment setup.

  devservices-bg.py start  Install the devservices version pinned in
                           $DEVSERVICES_LOCKFILE into a throwaway venv using the
                           system python, then start `devservices up` in the
                           background. Never fails the step: if anything goes
                           wrong it prints a warning and `wait` falls back to
                           the foreground.
  devservices-bg.py wait   Wait for a background `devservices up`, print its log
                           and exit with its status. If `start` didn't run or
                           didn't succeed, run `devservices up` in the
                           foreground with whatever devservices is on PATH.

Either way the exit status of `devservices up` is written to
$RUNNER_TEMP/devservices-ci/up.exit, which bootstrap-snuba.py watches via
DEVSERVICES_STATUS_FILE.

Environment: DEVSERVICES_MODE, DEVSERVICES_TIMEOUT (minutes, default 10),
DEVSERVICES_WORKDIR (default .), DEVSERVICES_LOCKFILE (start only).

Stdlib only. Kept in sync with getsentry's
.github/actions/start-devservices/devservices-bg.py.
"""

from __future__ import annotations

import os
import shutil
import signal
import subprocess
import sys
import time
import traceback
from pathlib import Path

STATE_DIR = Path(os.environ["RUNNER_TEMP"]) / "devservices-ci"
LOG_FILE = STATE_DIR / "up.log"
EXIT_FILE = STATE_DIR / "up.exit"
STARTED_FILE = STATE_DIR / "started"
PID_FILE = STATE_DIR / "pid"
VENV = STATE_DIR / "venv"

WORKDIR = os.environ.get("DEVSERVICES_WORKDIR", ".")
TIMEOUT = float(os.environ.get("DEVSERVICES_TIMEOUT", "10")) * 60

# Prevent git from spawning background gc/maintenance processes during
# dependency clones, which races with shutil.copytree (git 2.54 regression).
GIT_CONFIG = {"gc.auto": "0", "maintenance.auto": "0", "fetch.writeCommitGraph": "false"}


def git_config_set() -> None:
    for key, value in GIT_CONFIG.items():
        subprocess.run(["git", "config", "--global", key, value], check=True)


def git_config_unset() -> None:
    # Idempotent: unsetting a key that isn't set is fine.
    for key in GIT_CONFIG:
        subprocess.run(["git", "config", "--global", "--unset", key], check=False)


def write_status(rc: int) -> None:
    tmp = EXIT_FILE.with_suffix(".tmp")
    tmp.write_text(f"{rc}\n")
    tmp.replace(EXIT_FILE)


def kill_group(pgid: int, sig: signal.Signals) -> None:
    try:
        os.killpg(pgid, sig)
    except ProcessLookupError:
        pass


def devservices_up(devservices: str) -> int:
    """Run `devservices up`, killing it after TIMEOUT. Returns its exit status."""
    mode = os.environ["DEVSERVICES_MODE"]
    # Own process group, so a timeout also kills docker compose & co. (like
    # coreutils `timeout` did). `wait` uses the pid file as a backstop.
    proc = subprocess.Popen([devservices, "up", "--mode", mode], cwd=WORKDIR, process_group=0)
    PID_FILE.write_text(f"{proc.pid}\n")
    try:
        return proc.wait(timeout=TIMEOUT)
    except subprocess.TimeoutExpired:
        print(f"::error::devservices up timed out after {TIMEOUT:.0f}s", flush=True)
        kill_group(proc.pid, signal.SIGTERM)
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            pass
        kill_group(proc.pid, signal.SIGKILL)
        proc.wait()
        return 124


def pinned_devservices(lockfile: str) -> tuple[str, str]:
    import tomllib  # python >= 3.11; the runner's system python3 is 3.12

    with open(lockfile, "rb") as f:
        lock = tomllib.load(f)
    pkgs = [p for p in lock["package"] if p["name"] == "devservices"]
    if len(pkgs) != 1:
        raise RuntimeError(f"expected one devservices package in {lockfile}, found {len(pkgs)}")
    index = pkgs[0].get("source", {}).get("registry", "https://pypi.org/simple")
    return pkgs[0]["version"], index


def start() -> int:
    try:
        shutil.rmtree(STATE_DIR, ignore_errors=True)
        STATE_DIR.mkdir(parents=True)
        version, index = pinned_devservices(os.environ["DEVSERVICES_LOCKFILE"])
        print(f"Installing devservices=={version} from {index}", flush=True)
        # Run uv from the state dir so it doesn't pick up the repo's
        # pyproject.toml (and its requires-python) as a project.
        env = {**os.environ, "UV_PYTHON_DOWNLOADS": "never"}
        venv_python = str(VENV / "bin" / "python")
        for cmd in (
            ["uv", "venv", "--quiet", "--python", "python3", str(VENV)],
            ["uv", "pip", "install", "--quiet", "--python", venv_python]
            + ["--index-url", index, f"devservices=={version}"],
        ):
            subprocess.run(cmd, cwd=STATE_DIR, env=env, check=True)

        git_config_set()
        STARTED_FILE.touch()
        with open(LOG_FILE, "w") as log:
            # New session so it keeps running after this step's shell exits.
            subprocess.Popen(
                [sys.executable, os.path.abspath(__file__), "run-background"],
                stdin=subprocess.DEVNULL,
                stdout=log,
                stderr=subprocess.STDOUT,
                start_new_session=True,
            )
    except Exception as e:
        # Popen is the last thing that can fail, and if it does no child
        # exists, so nothing is running and `wait` can safely start over.
        STARTED_FILE.unlink(missing_ok=True)
        git_config_unset()
        print(
            f"::warning::Couldn't start devservices early ({e}); "
            "it will start after the Python setup instead",
            flush=True,
        )
        return 0
    print(f"Started devservices up in the background (log: {LOG_FILE})", flush=True)
    return 0


def run_background() -> int:
    rc = 1
    try:
        rc = devservices_up(str(VENV / "bin" / "devservices"))
    except BaseException:
        traceback.print_exc()
    finally:
        sys.stdout.flush()
        git_config_unset()
        write_status(rc)
    return rc


def run_foreground() -> int:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    devservices = shutil.which("devservices")
    if devservices is None:
        print("::error::devservices not found on PATH", flush=True)
        write_status(127)
        return 127
    git_config_set()
    rc = 1
    try:
        rc = devservices_up(devservices)
    finally:
        write_status(rc)
        git_config_unset()
    return rc


def wait() -> int:
    if not STARTED_FILE.exists():
        return run_foreground()

    # devservices up is already bounded by TIMEOUT; this is a backstop in case
    # the background process itself died without writing its status.
    start_time = time.monotonic()
    next_status = 30.0
    while not EXIT_FILE.exists():
        elapsed = time.monotonic() - start_time
        if elapsed > TIMEOUT + 60:
            print(LOG_FILE.read_text(errors="replace"), flush=True)
            print("::error::Timed out waiting for background devservices up", flush=True)
            if PID_FILE.exists():
                kill_group(int(PID_FILE.read_text()), signal.SIGKILL)
            write_status(124)
            git_config_unset()
            return 124
        if elapsed >= next_status:
            print(f"still waiting for background devservices up ({elapsed:.0f}s)", flush=True)
            next_status = elapsed + 30
        time.sleep(1)

    print(LOG_FILE.read_text(errors="replace"), flush=True)
    rc = int(EXIT_FILE.read_text().strip())
    if rc != 0:
        print(f"::error::devservices up failed (exit {rc})", flush=True)
    return rc


def main() -> int:
    commands = {"start": start, "wait": wait, "run-background": run_background}
    if len(sys.argv) != 2 or sys.argv[1] not in commands:
        print(f"usage: {sys.argv[0]} start|wait", file=sys.stderr)
        return 2
    return commands[sys.argv[1]]()


if __name__ == "__main__":
    sys.exit(main())
