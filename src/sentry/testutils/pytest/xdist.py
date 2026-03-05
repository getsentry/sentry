"""Per-worker test isolation for parallel pytest processes.

Every pytest process automatically gets an isolated worker identity (separate
PostgreSQL databases, Redis DB, Kafka topics) unless ``SENTRY_PYTEST_SERIAL=1``
is set.

Worker identity is resolved in this order:

1. ``SENTRY_PYTEST_SERIAL=1`` → no isolation, all defaults (old behaviour).
2. ``SENTRY_TEST_WORKER_ID`` env var (set by ``sentry-parallel`` or explicitly).
3. Random hex string (default for plain ``pytest``).
"""

from __future__ import annotations

import os
import secrets

_TEST_REDIS_DB = 9
_MAX_SLOTS = 7  # Redis supports DBs 0-15; base DB is 9 → slots 0-6.


# ---------------------------------------------------------------------------
# Resolve identity
# ---------------------------------------------------------------------------

_serial = os.environ.get("SENTRY_PYTEST_SERIAL") == "1"

# Set by sentry-parallel plugin or manually.
_standalone_id: str | None = os.environ.get("SENTRY_TEST_WORKER_ID")

worker_id: str | None
worker_num: int | None

if _serial:
    worker_id = None
    worker_num = None
elif _standalone_id is not None:
    worker_id = _standalone_id
    worker_num = int(_standalone_id)
else:
    # Random hex gives unique DB names and Kafka topics without file locks.
    # worker_num is derived via hash for Redis DB selection (0-6).
    worker_id = secrets.token_hex(4)
    worker_num = int(worker_id, 16) % _MAX_SLOTS


# -- PostgreSQL ----------------------------------------------------------------


def get_db_suffix() -> str:
    """Return a suffix for PostgreSQL database names, or ``""`` for serial.

    Examples: ``"_2"``, ``"_a1b2c3d4"``, ``""``.
    """
    if worker_id is not None:
        return f"_{worker_id}"
    return ""


# -- Redis ---------------------------------------------------------------------


def get_redis_db() -> int:
    """Return a Redis DB number unique to this worker."""
    if worker_num is not None:
        return _TEST_REDIS_DB + worker_num
    return _TEST_REDIS_DB


# -- Kafka ---------------------------------------------------------------------


def get_kafka_topic(base_name: str) -> str:
    """Return a Kafka topic name unique to this worker."""
    if worker_id:
        return f"{base_name}-{worker_id}"
    return base_name


# -- Snuba / ClickHouse -------------------------------------------------------


def get_snuba_url() -> str | None:
    """Return the ``SNUBA`` env var if set, or ``None`` for the default."""
    return os.environ.get("SNUBA") or None
