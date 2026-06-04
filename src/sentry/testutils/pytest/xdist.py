from __future__ import annotations

import os

_TEST_REDIS_DB = 9
_SNUBA_BASE_PORT = 1230
# Redis defaults to 16 DBs (0-15). With base DB 9, max 7 workers (gw0-gw6).
_MAX_WORKERS = 7

_worker_id: str | None = os.environ.get("PYTEST_XDIST_WORKER")
_worker_num: int | None = int(_worker_id.replace("gw", "")) if _worker_id else None

if _worker_num is not None and _worker_num >= _MAX_WORKERS:
    raise RuntimeError(
        f"xdist worker {_worker_id} exceeds max supported workers ({_MAX_WORKERS}). "
        f"Redis only has DBs 0-15 and base DB is {_TEST_REDIS_DB}."
    )


def get_redis_db() -> int:
    if _worker_num is not None:
        return _TEST_REDIS_DB + _worker_num
    return _TEST_REDIS_DB


def get_kafka_topic(base_name: str) -> str:
    if _worker_id:
        return f"{base_name}-{_worker_id}"
    return base_name


def get_snuba_url() -> str | None:
    if _worker_num is not None and os.environ.get("XDIST_PER_WORKER_SNUBA"):
        return f"http://127.0.0.1:{_SNUBA_BASE_PORT + _worker_num}"
    return None
