#!/usr/bin/env python3
"""Bootstrap per-worker Snuba instances for CI.

Phase 1: Create per-worker databases and run ``snuba bootstrap --force``
  for each of them.
Phase 2: Stop snuba-snuba-1 and start per-worker API containers.

Usage:
  bootstrap-snuba.py           Run in the foreground, after devservices is up.
  bootstrap-snuba.py --start   Run in the background.
  bootstrap-snuba.py --wait    Wait for the background run and exit with its status.

With DEVSERVICES_STATUS_FILE set (the exit status of a background
``devservices up``), phase 1 starts once ClickHouse, Kafka and Redis are
healthy, and phase 2 waits for ``devservices up`` to succeed, since it
health-checks snuba-snuba-1. If devservices fails, this fails fast.

Requires: XDIST_WORKERS env var
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
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
    "SNUBA_SETTINGS": "docker",
}

ENV_ARGS = [flag for k, v in SNUBA_ENV.items() for flag in ("-e", f"{k}={v}")]


def redis_db_args(worker_id: int) -> list[str]:
    # Each test's Snuba reset (/tests/<dataset>/drop) flushes Snuba's Redis DB. On a
    # shared DB that wipes other workers' replacement state (exclude-groups /
    # needs-final flags, query cache) mid-test. DBs 1-7 stay below the Sentry
    # per-worker DBs (9+, see src/sentry/testutils/pytest/xdist.py).
    return ["-e", f"REDIS_DB={1 + worker_id}"]


# What `snuba bootstrap` talks to. In early mode phase 1 only waits for these.
BOOTSTRAP_DEPENDENCIES = ("snuba-clickhouse-1", "kafka-kafka-1", "redis-redis-1")

# Set by the workflow when setup-sentry starts devservices in the background.
DEVSERVICES_STATUS_FILE = os.environ.get("DEVSERVICES_STATUS_FILE", "")
EARLY = bool(DEVSERVICES_STATUS_FILE)
# setup-sentry stops waiting for devservices up after 10 minutes.
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


def devservices_succeeded() -> bool:
    """True once `devservices up` has succeeded. Fails fast if it failed."""
    try:
        with open(DEVSERVICES_STATUS_FILE) as f:
            status = int(f.read())
    except (OSError, ValueError):
        return False  # still running
    if status != 0:
        fail(f"devservices up failed (exit {status}); not bootstrapping Snuba")
    return True


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
            # Only wait for what `snuba bootstrap` needs, not for snuba-snuba-1
            # to finish its own bootstrap.
            deps_ok = devservices_succeeded() or all(
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
    while not devservices_succeeded():
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
            *redis_db_args(worker_id),
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
        *redis_db_args(worker_id),
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
    with open(LOG_FILE, "w") as log_file:
        # A new session, so it outlives this step.
        subprocess.Popen(
            [sys.executable, __file__, "--run-background"],
            stdin=subprocess.DEVNULL,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
    log(f"Started Snuba bootstrap in the background, log: {LOG_FILE}")


def run_background() -> None:
    # Run the bootstrap as a child, so any failure, including an uncaught
    # exception, ends up as its exit status. Write-then-rename, so --wait never
    # reads a partial file.
    rc = subprocess.call([sys.executable, __file__])
    with open(f"{EXIT_FILE}.tmp", "w") as f:
        f.write(f"{rc}\n")
    os.replace(f"{EXIT_FILE}.tmp", EXIT_FILE)


def wait_background(timeout: int = WAIT_TIMEOUT) -> None:
    deadline = time.monotonic() + timeout
    while not os.path.exists(EXIT_FILE) and time.monotonic() < deadline:
        time.sleep(1)
    with open(LOG_FILE) as f:
        log(f.read())
    if not os.path.exists(EXIT_FILE):
        fail(f"Timed out after {timeout}s waiting for the background Snuba bootstrap")
    with open(EXIT_FILE) as f:
        rc = int(f.read())
    if rc != 0:
        log(f"::error::Background Snuba bootstrap failed (exit {rc})")
    sys.exit(rc)


if __name__ == "__main__":
    match sys.argv[1:]:
        case []:
            main()
        case ["--start"]:
            start_background()
        case ["--run-background"]:
            run_background()
        case ["--wait"]:
            wait_background()
        case _:
            fail(f"Unknown arguments: {sys.argv[1:]}")
