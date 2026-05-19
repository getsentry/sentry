from __future__ import annotations

import os

# Redis defaults to 16 databases (0-15). We reserve DBs 0-8 for non-test
# use and assign test workers to DBs 9-15.  With a base of 9 that gives 7
# usable slots (gw0-gw6).  When there are more workers than slots we wrap
# around using modulo so we never crash; adjacent workers may share a DB,
# but flushdb() still provides per-test isolation within each worker.
_TEST_REDIS_DB_BASE = 9
_REDIS_DB_COUNT = 16  # Redis default; configure "databases N" to increase
_REDIS_TEST_SLOTS = _REDIS_DB_COUNT - _TEST_REDIS_DB_BASE  # 7 slots (9-15)

_SNUBA_BASE_PORT = 1230

_worker_id: str | None = os.environ.get("PYTEST_XDIST_WORKER")
_worker_num: int | None = int(_worker_id.replace("gw", "")) if _worker_id else None


def get_redis_db() -> int:
    """Return the Redis DB number for this xdist worker.

    Each worker gets its own DB so that ``flushdb()`` in teardown only
    affects that worker's data.  Workers are mapped round-robin into the
    available test DB slots when there are more workers than slots.
    """
    if _worker_num is not None:
        return _TEST_REDIS_DB_BASE + (_worker_num % _REDIS_TEST_SLOTS)
    return _TEST_REDIS_DB_BASE


def get_kafka_topic(base_name: str) -> str:
    if _worker_id:
        return f"{base_name}-{_worker_id}"
    return base_name


def get_snuba_url() -> str | None:
    """Return the per-worker Snuba URL, or None if not in per-worker Snuba mode.

    Reads both env vars at call time (not just at module import time) to handle
    any edge case where xdist.py was imported before the subprocess environment
    was fully initialised.
    """
    if not os.environ.get("XDIST_PER_WORKER_SNUBA"):
        return None
    worker_id = os.environ.get("PYTEST_XDIST_WORKER") or ""
    if not worker_id.startswith("gw"):
        return None
    try:
        worker_num = int(worker_id[2:])
    except ValueError:
        return None
    return f"http://127.0.0.1:{_SNUBA_BASE_PORT + worker_num}"
