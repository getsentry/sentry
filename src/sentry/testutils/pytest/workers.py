from __future__ import annotations

import fcntl
import os
import subprocess
from pathlib import Path

from pytest_parallel.api import current_run, current_worker

_REDIS_DB = 9
_SNUBA_BASE_PORT = 1230
_MAX_WORKERS = 7

_service_lock_fds: list[int] = []


def parallel_run_id() -> str | None:
    run = current_run()
    if run is None or run.role not in {"controller", "worker"}:
        return None
    return run.run_id


def parallel_worker_index() -> int | None:
    worker = current_worker()
    if worker is None:
        return None
    return worker.index


def get_redis_db() -> int:
    index = parallel_worker_index()
    if index is None:
        return _REDIS_DB
    return _REDIS_DB + index


def get_redis_cluster_key_prefix() -> str:
    index = parallel_worker_index()
    if index is None:
        return "test-main:"
    return f"test-gw{index}:"


def get_kafka_topic(base_name: str) -> str:
    index = parallel_worker_index()
    if index is None:
        return base_name
    return f"{base_name}-gw{index}"


def get_snuba_url() -> str | None:
    index = parallel_worker_index()
    if index is None or not os.environ.get("SENTRY_TEST_PER_WORKER_SNUBA"):
        return None
    return f"http://127.0.0.1:{_SNUBA_BASE_PORT + index}"


def snowflake_id() -> int:
    index = parallel_worker_index()
    if index is None:
        return 0
    return index + 1


def parallel_max_workers() -> int:
    return _MAX_WORKERS


def configure_worker_env(env: dict[str, str], _worker_id: int) -> None:
    env.pop("DJANGO_SETTINGS_MODULE", None)
    env.pop("PYTEST_SHARD_PARTS", None)


def database_suffix(worker_index: int | None) -> str | None:
    if type(worker_index) is int:
        return f"gw{worker_index}"
    return None


def apply_database_suffix() -> None:
    suffix = database_suffix(parallel_worker_index())
    if suffix is not None:
        from pytest_django.fixtures import _set_suffix_to_test_databases

        _set_suffix_to_test_databases(suffix=suffix)


def default_service_lock_path() -> Path:
    completed = subprocess.run(
        ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
        check=True,
        capture_output=True,
        text=True,
    )
    return Path(completed.stdout.strip()).parent / ".work" / "sentry-service.lock"


def acquire_service_lock(path: Path) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(os.fspath(path), os.O_RDWR | os.O_CREAT, 0o644)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        os.close(fd)
        raise
    _service_lock_fds.append(fd)
    return fd


def acquire_controller_service_lock() -> None:
    run = current_run()
    if run is None or run.role not in {"controller", "serial"}:
        return
    acquire_service_lock(default_service_lock_path())
