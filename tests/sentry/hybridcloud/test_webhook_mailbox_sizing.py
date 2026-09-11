from dataclasses import replace
from time import time
from typing import Any
from unittest.mock import MagicMock, patch

from django.conf import settings
from redis.exceptions import RedisError

from sentry.hybridcloud.mailbox import MailboxName
from sentry.hybridcloud.webhook_mailbox_sizing import (
    SHARD_COUNT,
    SHARD_SECONDS,
    SHARD_TTL_SECONDS,
    STRICT_BUCKET_COUNT,
    WINDOW_SECONDS,
    _count_for_payloads,
    _max_buckets,
    _rate_counter_key,
    _shard_key,
    mailbox_bucket_count,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils import redis

THREADS = 4
PER_THREAD = 4
DEPTH = THREADS * PER_THREAD

MAILBOX = MailboxName("github", "4321")
"""A provider the delivery side may reorder, so its width follows its rate."""

STRICT_MAILBOX = MailboxName("jira", "4321")
"""A provider delivered in order, so its width is fixed."""


def redis_client() -> Any:
    return redis.redis_clusters.get(settings.SENTRY_RATE_LIMIT_REDIS_CLUSTER)


def seed_window(mailbox: MailboxName, payloads: int, shards_ago: int = 0) -> None:
    """Put `payloads` into one of the mailbox's shards without routing anything."""
    shard = int(time() // SHARD_SECONDS) - shards_ago
    counter_key = _rate_counter_key(mailbox)
    redis_client().set(_shard_key(counter_key, shard), payloads, ex=SHARD_TTL_SECONDS)


class CountForPayloadsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        # Pinned rather than left to the option's default: the depth is read per call,
        # so a sweep would otherwise put thousands of option lookups behind it.
        self.enterContext(
            override_options(
                {
                    "hybridcloud.webhookpayload.worker_threads": THREADS,
                    "hybridcloud.webhookpayload.payloads_per_thread": PER_THREAD,
                }
            )
        )

    def test_a_rate_that_cannot_fill_two_mailboxes_does_not_split(self) -> None:
        assert _count_for_payloads(0) == 1
        assert _count_for_payloads(DEPTH) == 1
        assert _count_for_payloads(2 * DEPTH - 1) == 1

    def test_the_rate_has_to_double_to_add_a_bucket(self) -> None:
        assert _count_for_payloads(2 * DEPTH) == 2
        assert _count_for_payloads(4 * DEPTH - 1) == 2
        assert _count_for_payloads(4 * DEPTH) == 4

    def test_every_count_is_a_power_of_two(self) -> None:
        """Including the cap: `min` can only preserve the property if it is one too."""
        for rate in range(0, 1_000_000, 37):
            count = _count_for_payloads(rate)
            assert count & (count - 1) == 0, f"sized {rate} to {count}"

    def test_a_widening_split_moves_half_the_keys(self) -> None:
        """Powers of two are what make a resize survivable: a key lands either where
        the narrower split put it or exactly that many buckets along."""
        narrow = _count_for_payloads(2 * DEPTH)
        wide = _count_for_payloads(4 * DEPTH)

        keys = range(10_000)
        unmoved = sum(1 for key in keys if key % narrow == key % wide)
        assert unmoved == len(keys) // 2

    def test_the_split_stops_at_the_cap(self) -> None:
        assert _count_for_payloads(10**9) == _max_buckets()

    def test_a_cap_that_is_not_a_power_of_two_is_floored(self) -> None:
        """The ladder is doublings, so a cap off it would make a resize into the cap
        re-map nearly every key instead of half."""
        with override_options({"hybridcloud.webhookpayload.max_mailbox_buckets": 100}):
            assert _count_for_payloads(10**9) == 64

    def test_an_option_set_to_zero_does_not_divide_by_it(self) -> None:
        """Both options are automator-modifiable and neither is validated, and the
        drain reads a zero `worker_threads` as one rather than rejecting it."""
        for zeroed in ("payloads_per_thread", "worker_threads"):
            with override_options({f"hybridcloud.webhookpayload.{zeroed}": 0}):
                assert _count_for_payloads(0) == 1
                assert _count_for_payloads(10**9) == _max_buckets()

    def test_a_rate_redis_could_not_answer_sizes_to_the_cap(self) -> None:
        """Wide is the safe direction to be wrong in: an outage must not put a busy
        integration back onto one serially drained mailbox."""
        assert _count_for_payloads(None) == _max_buckets()


class MailboxBucketCountTest(TestCase):
    """Sized against a shallow mailbox so a handful of payloads exercises the split."""

    def setUp(self) -> None:
        super().setUp()
        # One delivery thread at four payloads each, so four fill a mailbox.
        self.enterContext(
            override_options(
                {
                    "hybridcloud.webhookpayload.worker_threads": 1,
                    "hybridcloud.webhookpayload.payloads_per_thread": 4,
                }
            )
        )

    def test_each_payload_is_counted_once(self) -> None:
        with freeze_time("2000-01-01"):
            for _ in range(3):
                mailbox_bucket_count(MAILBOX)

            shard = int(time() // SHARD_SECONDS)
            assert redis_client().get(_shard_key(_rate_counter_key(MAILBOX), shard)) == "3"

    def test_the_split_widens_as_the_rate_climbs(self) -> None:
        with freeze_time("2000-01-01"):
            counts = [mailbox_bucket_count(MAILBOX) for _ in range(32)]

        # Four payloads to a mailbox: one mailbox until the 8th payload of the window,
        # two until the 16th, four until the 32nd.
        assert counts[:7] == [1] * 7
        assert counts[7:15] == [2] * 8
        assert counts[15:31] == [4] * 16
        assert counts[31] == 8

    def test_payloads_earlier_in_the_window_still_count(self) -> None:
        with freeze_time("2000-01-01"):
            seed_window(MAILBOX, payloads=7, shards_ago=SHARD_COUNT - 1)

            assert mailbox_bucket_count(MAILBOX) == 2

    def test_payloads_older_than_the_window_drop_out(self) -> None:
        with freeze_time("2000-01-01"):
            seed_window(MAILBOX, payloads=10_000, shards_ago=SHARD_COUNT)

            assert mailbox_bucket_count(MAILBOX) == 1

    def test_a_shard_expires_without_being_kept_alive(self) -> None:
        with freeze_time("2000-01-01"):
            mailbox_bucket_count(MAILBOX)
            shard = int(time() // SHARD_SECONDS)

        ttl = redis_client().ttl(_shard_key(_rate_counter_key(MAILBOX), shard))

        # A shard only takes writes while it is the current one, so the fixed TTL
        # bounds its life rather than being pushed out by every payload.
        assert WINDOW_SECONDS < ttl <= SHARD_TTL_SECONDS

    def test_each_mailbox_family_has_its_own_window(self) -> None:
        """A dimension that separates mailboxes ahead of bucketing separates the rate
        too, so one busy event type does not size the split for a quiet one."""
        with freeze_time("2000-01-01"):
            seed_window(replace(MAILBOX, event_type="push"), payloads=10_000)

            count = mailbox_bucket_count(replace(MAILBOX, event_type="check_run"))

        assert count == 1

    def test_a_strictly_ordered_provider_has_a_fixed_width(self) -> None:
        with freeze_time("2000-01-01"):
            seed_window(STRICT_MAILBOX, payloads=10_000)

            assert mailbox_bucket_count(STRICT_MAILBOX) == STRICT_BUCKET_COUNT

    def test_a_strictly_ordered_provider_is_not_counted(self) -> None:
        """Nothing sizes from its rate, so nothing should be paying to measure one."""
        with freeze_time("2000-01-01"):
            mailbox_bucket_count(STRICT_MAILBOX)

            shard = int(time() // SHARD_SECONDS)
            assert redis_client().get(_shard_key(_rate_counter_key(STRICT_MAILBOX), shard)) is None

    def test_a_provider_that_starts_tolerating_reordering_starts_sizing(self) -> None:
        """The carve-out dissolves on the option that grants the tolerance, so it
        cannot outlive the constraint it exists for."""
        with freeze_time("2000-01-01"):
            seed_window(STRICT_MAILBOX, payloads=10_000)

            with override_options(
                {"hybridcloud.webhookpayload.skip_on_failure_providers": ["jira"]}
            ):
                assert mailbox_bucket_count(STRICT_MAILBOX) == _max_buckets()

    def test_a_redis_error_sizes_to_the_cap(self) -> None:
        with patch(
            "sentry.hybridcloud.webhook_mailbox_sizing.redis.redis_clusters.get",
            side_effect=RedisError("unreachable"),
        ):
            count = mailbox_bucket_count(MAILBOX)

        assert count == _max_buckets()

    def test_a_reply_that_does_not_destructure_sizes_to_the_cap(self) -> None:
        """Sizing runs before the payload row is written, so a reply we cannot read has
        to fail the same way an outage does rather than 500 a webhook we could queue."""
        pipeline = MagicMock()
        pipeline.execute.return_value = [1]

        with patch(
            "sentry.hybridcloud.webhook_mailbox_sizing.redis.redis_clusters.get",
            return_value=MagicMock(pipeline=MagicMock(return_value=pipeline)),
        ):
            assert mailbox_bucket_count(MAILBOX) == _max_buckets()

    def test_a_reply_that_does_not_coerce_sizes_to_the_cap(self) -> None:
        pipeline = MagicMock()
        pipeline.execute.return_value = ["not-a-number", True, []]

        with patch(
            "sentry.hybridcloud.webhook_mailbox_sizing.redis.redis_clusters.get",
            return_value=MagicMock(pipeline=MagicMock(return_value=pipeline)),
        ):
            assert mailbox_bucket_count(MAILBOX) == _max_buckets()
