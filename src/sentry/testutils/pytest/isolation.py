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

ClickHouse / Snuba note: tables are dropped and recreated once per session
(by the ``reset_snuba`` fixture or the parallel coordinator).  Within a
session, isolation relies on unique snowflake IDs — each test gets fresh
org / project IDs that never collide, so ClickHouse rows from other tests
are invisible.  The Redis ``flushdb`` in test teardown preserves
``snowflakeid:*`` keys so that ``@freeze_time`` tests don't regenerate
the same IDs.  Tests that query ClickHouse without org/project filtering
(e.g. cross-org discovery queries) must scope assertions to their own IDs.
"""

from __future__ import annotations

import atexit
import fcntl
import os
import tempfile
from pathlib import Path

_TEST_REDIS_DB = 9  # Must match the historical default in sentry.py.
_MAX_SLOTS = 15  # Slots 0-14 → Redis DBs 9, 1-8, 10-15.  DB 0 reserved for dev.

_SLOT_DIR = Path(tempfile.gettempdir()) / "sentry_test_slots"

# Hold the lock fd at module level so GC doesn't close it (releasing the lock).
_slot_lock_fd: object | None = None


def _acquire_slot() -> int:
    """Claim an exclusive slot via file lock.  Returns 0–(_MAX_SLOTS-1)."""
    global _slot_lock_fd
    _SLOT_DIR.mkdir(exist_ok=True)
    for slot in range(_MAX_SLOTS):
        lock_path = _SLOT_DIR / f"slot_{slot}.lock"
        fd = open(lock_path, "w")
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            _slot_lock_fd = fd
            atexit.register(fd.close)
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
    # Serial mode uses the same DB/Redis/Kafka as slot 0.  Acquire slot 0's
    # lock so a concurrent auto-allocated process can't collide with us.
    try:
        _acquire_slot()
    except (OSError, RuntimeError):
        pass  # Best-effort — don't block serial mode if locking fails.
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
    """Return a suffix for PostgreSQL database names, or ``""`` for serial/slot-0.

    Slot 0 returns ``""`` so the default database name matches the historical
    unsuffixed name — critical for ``--reuse-db`` and ClickHouse data alignment.
    """
    if worker_num is not None and worker_num > 0:
        return f"_{worker_num}"
    return ""


# -- Redis ---------------------------------------------------------------------


def get_redis_db() -> int:
    """Return a Redis DB number unique to this worker.

    Slot 0 → DB 9 (historical default).  Slots 1-8 → DBs 1-8.
    Slots 9-14 → DBs 10-15.  DB 0 is reserved for dev.
    """
    if worker_num is None or worker_num == 0:
        return _TEST_REDIS_DB
    if worker_num < _TEST_REDIS_DB:
        return worker_num  # slots 1-8 → DBs 1-8
    return worker_num + 1  # slots 9-14 → DBs 10-15 (skip DB 9)


# -- Kafka ---------------------------------------------------------------------


def get_kafka_topic(base_name: str) -> str:
    """Return a Kafka topic name unique to this worker.

    Slot 0 returns the base name (matching serial mode) for backward compat.
    """
    if worker_num is not None and worker_num > 0:
        return f"{base_name}-{worker_num}"
    return base_name


# -- Snuba / ClickHouse -------------------------------------------------------


def get_snuba_url() -> str | None:
    """Return the ``SNUBA`` env var if set, or ``None`` for the default."""
    return os.environ.get("SNUBA") or None
