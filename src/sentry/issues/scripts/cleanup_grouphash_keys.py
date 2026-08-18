from __future__ import annotations

import logging
import time
from collections.abc import Callable, Iterator, Sequence
from typing import Any, NamedTuple

from django.conf import settings
from redis.exceptions import ResponseError

from sentry.issues.grouptype import NoiseConfig
from sentry.utils import redis

logger = logging.getLogger(__name__)

#: Only keys under this prefix are swept
MATCH = "grouphash:*"

#: Non-expiring keys must be this old in order to get swept
MIN_IDLE_SECONDS = NoiseConfig().expiry_seconds

#: Redis holds the LRU clock in 24 bits at one second resolution, so
#: `OBJECT IDLETIME` cannot report an age above this. A key older than this wraps
#: and reports a smaller age, which keeps the key rather than removing it early.
#: We'll have to run this sweep again if we want to catch these cases.
MAX_REPORTABLE_IDLE_SECONDS = (1 << 24) - 1

#: Classify one key, and for the delete form remove it. All three guards run
#: server side inside the same call, so nothing can change between the check and
#: the delete.
#:
#: `TTL == -1`     The key has no expiry, so it is not a live noise-reduction
#:                 counter. A grouphash still counting toward an `ignore_limit`
#:                 always has a TTL and is never touched.
#: `REFCOUNT == 1` The value is a private object, so its LRU clock belongs to
#:                 this key alone. Redis shares one object for the integers 0 to
#:                 9999 unless `maxmemory` is set and `maxmemory-policy` is an
#:                 LRU policy, and a shared object's idle time says nothing about
#:                 any single key that points at it.
#: `IDLETIME`      Seconds since the key was last written. These keys are written
#:                 once and never read back, so this is the age of the key.
_CLASSIFY = """
local min_idle = tonumber(ARGV[1])
local stale, live, young, unreadable = 0, 0, 0, 0
for i = 1, #KEYS do
    local key = KEYS[i]
    if redis.call('TTL', key) ~= -1 then
        live = live + 1
    elseif redis.call('OBJECT', 'REFCOUNT', key) ~= 1 then
        unreadable = unreadable + 1
    elseif redis.call('OBJECT', 'IDLETIME', key) < min_idle then
        young = young + 1
    else
        stale = stale + 1
        %(on_stale)s
    end
end
return {stale, live, young, unreadable}
"""

#: Counts only. Holds no write command, so the dry run cannot change anything.
CLASSIFY = _CLASSIFY % {"on_stale": ""}

#: The same classification, and removes what it classifies as stale.
DELETE_IF_STALE = _CLASSIFY % {"on_stale": "redis.call('UNLINK', key)"}


class AgeUnreadable(RuntimeError):
    """The server cannot report a key's age, so the sweep must not run.

    Redis drops idle-time tracking under an LFU `maxmemory-policy`.
    """


class SweepResult(NamedTuple):
    scanned: int
    #: Keys removed, or the keys a dry run would remove.
    matched: int
    #: Skipped because the key still carries a TTL, or had already gone.
    skipped_live: int
    #: Skipped because the key has not yet reached `min_idle_seconds`.
    skipped_young: int
    #: Skipped because the value is a shared object, so the age is not readable.
    skipped_unreadable: int
    cursor: int


def get_client() -> Any:
    """The cluster `should_create_group` writes the grouphash keys to."""
    cluster_key = settings.SENTRY_ISSUE_PLATFORM_RATE_LIMITER_OPTIONS.get("cluster", "default")
    return redis.redis_clusters.get(cluster_key)


def _chunks(keys: Sequence[str], size: int) -> Iterator[Sequence[str]]:
    # SCAN treats COUNT as a hint, so one page can hold more keys than we asked
    # for. Keep each EVAL small so the server never blocks on a long key list.
    for start in range(0, len(keys), size):
        yield keys[start : start + size]


def _classify(script: Any, keys: Sequence[str], min_idle_seconds: int) -> tuple[int, int, int, int]:
    try:
        stale, live, young, unreadable = script(keys=keys, args=[min_idle_seconds])
    except ResponseError as e:
        if "LFU" in str(e):
            raise AgeUnreadable(
                "Redis reports no idle time under an LFU maxmemory-policy, so the age of a "
                "key cannot be checked. Do not run this sweep against this cluster."
            ) from e
        raise
    return stale, live, young, unreadable


def sweep(
    client: Any,
    *,
    match: str = MATCH,
    dry_run: bool = True,
    batch_size: int = 200,
    sleep: float = 0.0,
    min_idle_seconds: int = MIN_IDLE_SECONDS,
    max_deletes: int = 0,
    max_seconds: float = 0.0,
    start_cursor: int = 0,
    now: Callable[[], float] = time.monotonic,
) -> SweepResult:
    """Walk `match` and remove the keys that leaked and have since gone stale.

    `should_create_group` used to increment `grouphash:{hash}:{project_id}`
    before it looked at `noise_config`, then return early for any group type
    that does not set one. Those keys never got an expiry and nothing ever read
    them back.

    A key is removed only when it has no TTL and has been idle for at least
    `min_idle_seconds`, which is the expiry the counter would have carried had
    its group type set a `noise_config`. A key younger than that is left alone,
    so one pass does not drain the whole population. Run the sweep again later
    to take the rest.

    Returns the number of keys seen, the number removed (or removable, under
    `dry_run`), a count for each reason a key was skipped, and the cursor to
    resume from. A cursor of 0 means the walk finished.

    `max_deletes` and `max_seconds` both stop the walk early and hand back a
    live cursor, so a caller under a job deadline can return the offset instead
    of being killed and losing it.
    """
    script = client.register_script(CLASSIFY if dry_run else DELETE_IF_STALE)

    started = now()
    cursor = start_cursor
    scanned = 0
    matched = 0
    live = 0
    young = 0
    unreadable = 0

    while True:
        cursor, keys = client.scan(cursor=cursor, match=match, count=batch_size)
        scanned += len(keys)

        if keys:
            for chunk in _chunks(keys, batch_size):
                stale, chunk_live, chunk_young, chunk_unreadable = _classify(
                    script, chunk, min_idle_seconds
                )
                matched += stale
                live += chunk_live
                young += chunk_young
                unreadable += chunk_unreadable

            if sleep:
                time.sleep(sleep)

        result = SweepResult(scanned, matched, live, young, unreadable, cursor)

        if cursor == 0:
            return result._replace(cursor=0)

        if max_deletes and matched >= max_deletes:
            logger.info(
                "cleanup_grouphash_keys.stopped",
                extra={"reason": "max_deletes", **result._asdict()},
            )
            return result

        if max_seconds and now() - started >= max_seconds:
            logger.info(
                "cleanup_grouphash_keys.stopped",
                extra={"reason": "max_seconds", **result._asdict()},
            )
            return result
