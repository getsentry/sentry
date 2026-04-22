#!/usr/bin/env python3
"""Bootstrap per-worker Snuba instances for CI.

Overlaps the expensive ClickHouse table setup with the devservices
health-check wait.

Phase 1 (early): As soon as ClickHouse is accepting queries, create
  per-worker databases and run ``snuba bootstrap --force``.
Phase 2: Stop snuba-snuba-1 and start per-worker API containers.

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
    "REDIS_DB": "1",
    "SNUBA_SETTINGS": "docker",
}

ENV_ARGS = [flag for k, v in SNUBA_ENV.items() for flag in ("-e", f"{k}={v}")]


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


def wait_for_prerequisites(timeout: int = 300) -> None:
    log("Waiting for ClickHouse and Snuba container...")
    start = time.monotonic()
    next_status_at = 0.0
    while True:
        elapsed = time.monotonic() - start
        if elapsed > timeout:
            fail("Timed out waiting for Snuba bootstrap prerequisites")
        ch_ok = http_ok("http://localhost:8123/")
        snuba_ok = http_ok("http://localhost:1218/health")
        container_ok = bool(docker_inspect("snuba-snuba-1", "{{.Id}}"))
        if ch_ok and snuba_ok and container_ok:
            break
        if elapsed >= next_status_at:
            log(
                f"  still waiting ({elapsed:.0f}s): "
                f"clickhouse={'ok' if ch_ok else 'not ready'}  "
                f"snuba-snuba-1={'ok' if snuba_ok else 'not ready'}  "
                f"container={'ok' if container_ok else 'not ready'}"
            )
            next_status_at = elapsed + 30
        time.sleep(2)
    log(f"Prerequisites ready ({time.monotonic() - start:.0f}s)")


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
    workers = range(int(workers_str))
    start = time.monotonic()

    wait_for_prerequisites()
    image, network = inspect_snuba_container()

    log("Phase 1: bootstrapping ClickHouse databases")
    run_parallel(partial(bootstrap_worker, image=image, network=network), workers)
    log(f"Phase 1 done ({time.monotonic() - start:.0f}s)")

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


if __name__ == "__main__":
    main()
