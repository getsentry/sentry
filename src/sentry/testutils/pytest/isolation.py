"""Per-worker test isolation for parallel pytest processes.

Every pytest process automatically gets an isolated worker identity (separate
PostgreSQL databases, Redis DB, Kafka topics) unless ``SENTRY_PYTEST_SERIAL=1``
is set.

Worker identity is resolved in this order:

1. ``SENTRY_PYTEST_SERIAL=1`` → no isolation, all defaults (old behaviour).
2. ``SENTRY_TEST_WORKER_ID`` env var (set by ``sentry-parallel`` or explicitly).
3. File-lock slot allocation (default for plain ``pytest``).

File locks guarantee exclusive Redis DB access and stable DB names (so
``--reuse-db`` works).  Locks are released automatically when the process
exits, even on crash.

ClickHouse / Snuba note: tables are NOT truncated between tests.  Isolation
relies on PostgreSQL sequence uniqueness — each test gets fresh project IDs
that never collide, so ClickHouse rows from other tests are invisible.  Any
test that queries ClickHouse without filtering by project_id will see
cross-worker data.
"""

from __future__ import annotations

import fcntl
import os
import tempfile
from pathlib import Path

_TEST_REDIS_DB = 1  # DB 0 is left for dev server / production defaults.
_MAX_SLOTS = 15  # Redis DBs 1-15 → slots 0-14.

_SLOT_DIR = Path(tempfile.gettempdir()) / "sentry_test_slots"

# Hold the lock fd at module level so GC doesn't close it (releasing the lock).
_slot_lock_fd: object | None = None


def _acquire_slot() -> int:
    """Claim an exclusive slot via file lock.  Returns 0-6."""
    global _slot_lock_fd
    _SLOT_DIR.mkdir(exist_ok=True)
    for slot in range(_MAX_SLOTS):
        lock_path = _SLOT_DIR / f"slot_{slot}.lock"
        fd = open(lock_path, "w")
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            _slot_lock_fd = fd
            return slot
        except OSError:
            fd.close()
    raise RuntimeError(
        f"All {_MAX_SLOTS} parallel test slots are in use. "
        "Wait for other test processes to finish or set SENTRY_PYTEST_SERIAL=1."
    )


# ---------------------------------------------------------------------------
# Resolve identity
# ---------------------------------------------------------------------------

_serial = os.environ.get("SENTRY_PYTEST_SERIAL") == "1"

# Set by sentry-parallel plugin or manually.
_explicit_id: str | None = os.environ.get("SENTRY_TEST_WORKER_ID")

worker_id: str | None
worker_num: int | None

if _serial:
    worker_id = None
    worker_num = None
elif _explicit_id is not None:
    worker_id = _explicit_id
    worker_num = int(_explicit_id)
else:
    # Acquire an exclusive slot via file lock.  Gives stable DB names
    # (--reuse-db works) and exclusive Redis DBs (no cross-session collision).
    worker_num = _acquire_slot()
    worker_id = str(worker_num)


# -- PostgreSQL ----------------------------------------------------------------


def get_db_suffix() -> str:
    """Return a suffix for PostgreSQL database names, or ``""`` for serial.

    Examples: ``"_0"``, ``"_3"``, ``""``.
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
