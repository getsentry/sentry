"""
Sizing an integration's webhook mailbox split from the rate it is currently sending.

Only where the delivery side may reorder: the divisor is the key-to-mailbox map, and
a provider delivered in order cannot have that map move under it.
"""

from __future__ import annotations

import logging
from dataclasses import replace
from time import time

from django.conf import settings
from redis.exceptions import RedisError

from sentry import options
from sentry.hybridcloud.mailbox import MailboxName
from sentry.utils import redis

logger = logging.getLogger(__name__)

WINDOW_SECONDS = 15 * 60
"""Long enough that a lull between bursts does not read as a quiet integration,
short enough that a burst raises the count within minutes."""

SHARD_SECONDS = 3 * 60
"""Width of one counter: how coarsely the window rolls, how far the estimate
undercounts while the current shard fills, and how many keys one read touches.

Nothing derives three minutes -- it is a fifth of the window. Minute shards would
read fifteen keys to be accurate within a fifteenth; five-minute shards three keys
to be accurate within a third.
"""

SHARD_COUNT = WINDOW_SECONDS // SHARD_SECONDS

SHARD_TTL_SECONDS = WINDOW_SECONDS + SHARD_SECONDS
"""A real bound despite being reset on every write: a shard takes writes only while
it is the current one."""

STRICT_BUCKET_COUNT = 10
"""Width for a provider delivered in order. Every change of divisor re-maps keys,
which would leave one issue's backlog draining concurrently with its next
payloads."""


def mailbox_bucket_count(mailbox: MailboxName) -> int:
    """How many sub-mailboxes to spread `mailbox`'s bucket keys over.

    Counts this payload against the window, so call it once per payload queued. A
    strictly ordered provider is not counted: nothing would read the result.
    """
    if not _tolerates_reordering(mailbox.provider):
        return STRICT_BUCKET_COUNT
    return _count_for_payloads(_record_and_read_window(_rate_counter_key(mailbox)))


def _payloads_per_mailbox() -> int:
    """Depth a mailbox reaches before its split widens.

    A drain delivers `worker_threads` payloads at once, so the depth is a whole
    number of those, and raising delivery concurrency narrows the split rather than
    leaving it where it was.

    Floored at one because both options are automator-modifiable and neither is
    validated: the drain reads a zero `worker_threads` as one rather than rejecting
    it, so a zero must not reach the division here either.
    """
    return max(
        1,
        options.get("hybridcloud.webhookpayload.payloads_per_thread")
        * options.get("hybridcloud.webhookpayload.worker_threads"),
    )


def _max_buckets() -> int:
    """Widest split allowed, floored to a power of two.

    The ladder `_count_for_payloads` climbs is doublings, and a cap off that ladder
    would make a resize into it re-map nearly every key instead of half -- so the set
    value is floored rather than trusted.
    """
    configured = options.get("hybridcloud.webhookpayload.max_mailbox_buckets")
    return 1 << (configured.bit_length() - 1) if configured >= 1 else 1


def _tolerates_reordering(provider: str) -> bool:
    """Read from the option the drain itself reads, so a provider earns a
    rate-derived width only once it tolerates the re-mapping that width costs."""
    return provider in (options.get("hybridcloud.webhookpayload.skip_on_failure_providers") or ())


def _rate_counter_key(mailbox: MailboxName) -> str:
    """The mailbox name without the parts one split varies: the bucket, which the
    split chooses, and the cell, since one mailbox is built for the whole fanout.

    Event type stays -- it separates mailboxes ahead of bucketing, so dropping it
    would size one split for every event type at once.
    """
    return str(replace(mailbox, cell=None, bucket=None))


def _count_for_payloads(payloads: int | None) -> int:
    """The widest split whose mailboxes would each still fill to the target depth,
    given the payloads counted over the window.

    Powers of two because `key % 2n` puts a key where `key % n` did or n along, so a
    doubling moves half the keys. Rounding down rather than to nearest is the
    hysteresis: the count has to double to add a bucket.

    A window we could not read sizes to the cap -- an outage must not re-serialize
    the integrations this exists to unserialize.
    """
    if payloads is None:
        return _max_buckets()

    mailboxes = payloads // _payloads_per_mailbox()
    if mailboxes < 2:
        return 1
    return min(1 << (mailboxes.bit_length() - 1), _max_buckets())


def _record_and_read_window(counter_key: str) -> int | None:
    """Count this payload and return the payloads over the window, or None when Redis
    could not answer.

    A reply that does not destructure or coerce counts as not answering: this runs
    before the payload row is written, so an exception escaping here would turn a
    webhook we could still have queued into a 500.

    The current shard is still filling, so the sum runs low by up to one shard and
    catches up -- the right direction, delaying a widening rather than forcing one.
    """
    shard = int(time() // SHARD_SECONDS)
    current_key = _shard_key(counter_key, shard)
    older_keys = [_shard_key(counter_key, shard - i) for i in range(1, SHARD_COUNT)]

    try:
        pipe = redis.redis_clusters.get(settings.SENTRY_RATE_LIMIT_REDIS_CLUSTER).pipeline()
        pipe.incr(current_key)
        pipe.expire(current_key, SHARD_TTL_SECONDS)
        pipe.mget(older_keys)
        current, _, older = pipe.execute()
        return int(current) + sum(int(count) for count in older if count is not None)
    except (RedisError, TypeError, ValueError, IndexError):
        logger.exception(
            "hybridcloud.webhook_mailbox_sizing.unavailable",
            extra={"counter_key": counter_key},
        )
        return None


def _shard_key(counter_key: str, shard: int) -> str:
    """Hash-tagged so one counter's shards share a slot and the window reads as a
    single-node pipeline."""
    return f"whrate:{{{counter_key}}}:{shard}"
