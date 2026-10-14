#!/usr/bin/env python3
"""Bootstrap per-worker Snuba instances for CI.

Phase 1: Create per-worker databases and run ``snuba bootstrap --force``
  for each of them.
Phase 2: Stop snuba-snuba-1 and start per-worker API containers.

Usage:
  bootstrap-snuba.py           Run in the foreground, after devservices is up.
  bootstrap-snuba.py --start   Start in the background and return immediately.
  bootstrap-snuba.py --wait    Wait for a background run, print its log and
                               exit with its status.

When DEVSERVICES_STATUS_FILE is set (setup-sentry writes the exit status of
``devservices up`` there), the expensive phase 1 starts as soon as ClickHouse,
Kafka and Redis are healthy, overlapping devservices' wait for snuba-snuba-1.
Phase 2 then waits for ``devservices up`` to exit successfully, so
snuba-snuba-1 is never stopped while devservices is still health-checking it.
If devservices fails, the bootstrap fails fast instead of timing out.

Requires: XDIST_WORKERS env var
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import partial
from typing import Any, Callable
from urllib.error import URLError
from urllib.request import urlopen

SNUBA_ENV = {
    "CLICKHOUSE_HOST": "clickhouse",
    "CLICKHOUSE_PORT": "9000",
    "CLICKHOUSE_HTTP_PORT": "8123",
    "DEFAULT_BROKERS": "kafka:9093",
    "REDIS_HOST": "redis",
    "REDIS_PORT": "6379",
    "REDIS_DB": "1",
    "SNUBA_SETTINGS": "docker",
}

ENV_ARGS = [flag for k, v in SNUBA_ENV.items() for flag in ("-e", f"{k}={v}")]

# Containers that `snuba bootstrap` talks to. In early mode phase 1 waits for
# Docker to report all of them healthy (the same check devservices uses).
BOOTSTRAP_DEPENDENCIES = ("snuba-clickhouse-1", "kafka-kafka-1", "redis-redis-1")

# Set by the workflow when setup-sentry starts devservices in the background.
DEVSERVICES_STATUS_FILE = os.environ.get("DEVSERVICES_STATUS_FILE", "")
EARLY = bool(DEVSERVICES_STATUS_FILE)
# devservices up itself is bounded by a 10 minute timeout in setup-sentry.
PREREQ_TIMEOUT = 900 if EARLY else 300

STATE_DIR = os.path.join(os.environ.get("RUNNER_TEMP", "/tmp"), "snuba-bootstrap")
LOG_FILE = os.path.join(STATE_DIR, "log")
EXIT_FILE = os.path.join(STATE_DIR, "exit")
WAIT_TIMEOUT = 1200


def retry(
    fn: Callable[[], Any], *, attempts: int = 3, delay: int = 5, label: str = "operation"
) -> Any:
    for i in range(attempts):
        try:
            return fn()
        except Exception:
            if i == attempts - 1:
                raise
            log(f"{label} failed (attempt {i + 1}/{attempts}), retrying in {delay}s...")
            time.sleep(delay)


def log(msg: str) -> None:
    print(msg, flush=True)


def fail(msg: str) -> None:
    log(f"::error::{msg}")
    sys.exit(1)


def http_ok(url: str) -> bool:
    try:
        with urlopen(url, timeout=3):
            return True
    except (URLError, OSError):
        return False


def docker(
    *args: str, check: bool = False, timeout: int | None = None
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["docker", *args], capture_output=True, text=True, check=check, timeout=timeout
    )


def docker_inspect(container: str, fmt: str) -> str:
    r = docker("inspect", container, "--format", fmt)
    return r.stdout.strip() if r.returncode == 0 else ""


def inspect_snuba_container() -> tuple[str, str]:
    r = docker("inspect", "snuba-snuba-1", "--format", "{{json .}}")
    if r.returncode != 0:
        fail("Could not inspect snuba-snuba-1 container")
    info = json.loads(r.stdout)
    image = info["Config"]["Image"]
    network = next(iter(info["NetworkSettings"]["Networks"]), "")
    if not image or not network:
        fail("Could not inspect snuba-snuba-1 container")
    return image, network


def run_parallel(fn: Callable[[int], Any], workers: range, *, fail_fast: bool = True) -> int:
    """Run fn(i) in parallel for each i in workers. Returns 0 on full success."""
    rc = 0
    with ThreadPoolExecutor(max_workers=len(workers)) as pool:
        futs = {pool.submit(fn, i): i for i in workers}
        for fut in as_completed(futs):
            try:
                fut.result()
            except Exception as e:
                if fail_fast:
                    fail(str(e))
                log(f"ERROR: {e}")
                rc = 1
    return rc


def devservices_status() -> int | None:
    """Exit status of `devservices up`, or None if it hasn't exited yet."""
    try:
        with open(DEVSERVICES_STATUS_FILE) as f:
            return int(f.read().strip())
    except (OSError, ValueError):
        return None


def check_devservices() -> bool:
    """True once `devservices up` has succeeded. Fails fast if it failed."""
    status = devservices_status()
    if status is not None and status != 0:
        fail(f"devservices up failed (exit {status}); not bootstrapping Snuba")
    return status == 0


def container_healthy(container: str) -> bool:
    return docker_inspect(container, "{{.State.Health.Status}}") == "healthy"


def wait_for_prerequisites(timeout: int = PREREQ_TIMEOUT) -> None:
    log("Waiting for ClickHouse and Snuba container...")
    start = time.monotonic()
    next_status_at = 0.0
    while True:
        elapsed = time.monotonic() - start
        if elapsed > timeout:
            fail("Timed out waiting for Snuba bootstrap prerequisites")
        ch_ok = http_ok("http://localhost:8123/")
        container_ok = bool(docker_inspect("snuba-snuba-1", "{{.Id}}"))
        if EARLY:
            # Don't wait for snuba-snuba-1 to finish its own bootstrap, only for
            # the services `snuba bootstrap` needs. Once devservices up has
            # succeeded everything is healthy, so that alone is also enough
            # (in case container names ever change).
            deps_ok = check_devservices() or all(
                container_healthy(c) for c in BOOTSTRAP_DEPENDENCIES
            )
        else:
            deps_ok = http_ok("http://localhost:1218/health")
        if ch_ok and deps_ok and container_ok:
            break
        if elapsed >= next_status_at:
            log(
                f"  still waiting ({elapsed:.0f}s): "
                f"clickhouse={'ok' if ch_ok else 'not ready'}  "
                f"{'dependencies' if EARLY else 'snuba-snuba-1'}="
                f"{'ok' if deps_ok else 'not ready'}  "
                f"container={'ok' if container_ok else 'not ready'}"
            )
            next_status_at = elapsed + 30
        time.sleep(2)
    log(f"Prerequisites ready ({time.monotonic() - start:.0f}s)")


def wait_for_devservices(timeout: int = PREREQ_TIMEOUT) -> None:
    """In early mode, wait for `devservices up` to exit before phase 2.

    devservices health-checks snuba-snuba-1 until it's healthy, so stopping it
    any earlier would fail devservices up.
    """
    if not EARLY:
        return
    log("Waiting for devservices up to finish...")
    start = time.monotonic()
    while not check_devservices():
        if time.monotonic() - start > timeout:
            fail("Timed out waiting for devservices up to finish")
        time.sleep(1)
    log(f"devservices up finished ({time.monotonic() - start:.0f}s)")


def bootstrap_worker(worker_id: int, *, image: str, network: str) -> None:
    """Create a ClickHouse database and run snuba bootstrap."""
    db = f"default_gw{worker_id}"

    def create_db() -> None:
        with urlopen(
            "http://localhost:8123/", f"CREATE DATABASE IF NOT EXISTS {db}".encode(), timeout=30
        ):
            pass

    retry(create_db, label=f"CREATE DATABASE {db}")

    def run_bootstrap() -> None:
        r = docker(
            "run",
            "--rm",
            "--network",
            network,
            "-e",
            f"CLICKHOUSE_DATABASE={db}",
            *ENV_ARGS,
            image,
            "bootstrap",
            "--force",
        )
        for line in (r.stdout + r.stderr).strip().splitlines()[-3:]:
            log(line)
        if r.returncode != 0:
            raise RuntimeError(f"snuba bootstrap failed for worker {worker_id}")

    retry(run_bootstrap, label=f"snuba bootstrap gw{worker_id}")


def start_worker_container(worker_id: int, *, image: str, network: str) -> None:
    """Start a per-worker Snuba API container and wait for health."""
    db = f"default_gw{worker_id}"
    port = 1230 + worker_id
    name = f"snuba-gw{worker_id}"

    docker("rm", "-f", name)

    r = docker(
        "run",
        "-d",
        "--name",
        name,
        "--network",
        network,
        "-p",
        f"{port}:1218",
        "-e",
        f"CLICKHOUSE_DATABASE={db}",
        *ENV_ARGS,
        "-e",
        "DEBUG=1",
        image,
        "api",
    )
    if r.returncode != 0:
        raise RuntimeError(f"docker run {name} failed: {r.stderr.strip()}")

    for attempt in range(1, 31):
        if http_ok(f"http://127.0.0.1:{port}/health"):
            log(f"{name} healthy on port {port}")
            return
        if attempt == 30:
            r = docker("logs", name)
            for line in (r.stdout + r.stderr).strip().splitlines()[-20:]:
                log(line)
            raise RuntimeError(f"{name} failed health check after 30 attempts")
        time.sleep(2)


def main() -> None:
    workers_str = os.environ.get("XDIST_WORKERS")
    if not workers_str:
        fail("XDIST_WORKERS must be set")
    workers = range(int(workers_str))  # type: ignore[arg-type]
    start = time.monotonic()

    wait_for_prerequisites()
    image, network = inspect_snuba_container()

    log("Phase 1: bootstrapping ClickHouse databases")
    run_parallel(partial(bootstrap_worker, image=image, network=network), workers)
    log(f"Phase 1 done ({time.monotonic() - start:.0f}s)")

    wait_for_devservices()

    try:
        docker("stop", "snuba-snuba-1", timeout=30)
    except subprocess.TimeoutExpired:
        log("WARNING: docker stop snuba-snuba-1 timed out, killing")
        docker("kill", "snuba-snuba-1")

    log("Phase 2: starting per-worker Snuba API containers")
    rc = run_parallel(
        partial(start_worker_container, image=image, network=network),
        workers,
        fail_fast=False,
    )

    log(f"Snuba bootstrap complete ({time.monotonic() - start:.0f}s total)")
    sys.exit(rc)


def start_background() -> None:
    os.makedirs(STATE_DIR, exist_ok=True)
    for path in (LOG_FILE, EXIT_FILE):
        if os.path.exists(path):
            os.remove(path)
    with open(LOG_FILE, "w") as log_file:
        proc = subprocess.Popen(
            [sys.executable, os.path.abspath(__file__), "--run-background"],
            stdin=subprocess.DEVNULL,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
    log(f"Started Snuba bootstrap in the background (pid {proc.pid}), log: {LOG_FILE}")


def run_background() -> None:
    rc = 1
    try:
        main()
        rc = 0
    except SystemExit as e:
        rc = e.code if isinstance(e.code, int) else (0 if e.code is None else 1)
    except BaseException:
        traceback.print_exc()
    finally:
        sys.stdout.flush()
        tmp = f"{EXIT_FILE}.tmp"
        with open(tmp, "w") as f:
            f.write(f"{rc}\n")
        os.replace(tmp, EXIT_FILE)


def wait_background(timeout: int = WAIT_TIMEOUT) -> None:
    if not os.path.exists(LOG_FILE):
        fail("No background Snuba bootstrap found; was it started with --start?")
    start = time.monotonic()
    next_status_at = 30.0
    while not os.path.exists(EXIT_FILE):
        elapsed = time.monotonic() - start
        if elapsed > timeout:
            with open(LOG_FILE) as f:
                log(f.read())
            fail(f"Timed out after {timeout}s waiting for the background Snuba bootstrap")
        if elapsed >= next_status_at:
            log(f"  still waiting for background Snuba bootstrap ({elapsed:.0f}s)")
            next_status_at = elapsed + 30
        time.sleep(1)
    log(f"Background Snuba bootstrap finished (waited {time.monotonic() - start:.0f}s):")
    with open(LOG_FILE) as f:
        log(f.read())
    with open(EXIT_FILE) as f:
        rc = int(f.read().strip())
    if rc != 0:
        log(f"::error::Background Snuba bootstrap failed (exit {rc})")
    sys.exit(rc)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode == "--start":
        start_background()
    elif mode == "--run-background":
        run_background()
    elif mode == "--wait":
        wait_background()
    elif mode == "":
        main()
    else:
        fail(f"Unknown argument: {mode}")
