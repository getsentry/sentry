from datetime import datetime, timezone
from unittest.mock import patch

from sentry.integrations.slack.utils.nudge import should_send_nudge_block
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.utils.cache import cache

FEATURE_FLAG = "organizations:slack-reinstall-nudge-on-issue-alert"


def cache_key(channel_id: str) -> str:
    iso_year, iso_week, _ = datetime.now(timezone.utc).isocalendar()
    return f"slack:alert_nudge:{channel_id}:{iso_year}:{iso_week}"


class ShouldSendNudgeBlockTest(TestCase):
    channel_id = "C1234567890"

    def setUp(self) -> None:
        super().setUp()
        # By default make the 10% random gate pass; individual tests override this.
        patcher = patch("sentry.integrations.slack.utils.nudge.random.random", return_value=0.0)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_no_feature_flag(self) -> None:
        # Feature flag off: never post, even though the random gate passes and the
        # cache has plenty of room.
        assert cache.get(cache_key(self.channel_id)) is None
        assert (
            should_send_nudge_block(channel_id=self.channel_id, organization=self.organization)
            is False
        )
        # We bailed before touching the cache.
        assert cache.get(cache_key(self.channel_id)) is None

    @with_feature(FEATURE_FLAG)
    def test_random_gate_fails(self) -> None:
        with patch("sentry.integrations.slack.utils.nudge.random.random", return_value=0.5):
            assert (
                should_send_nudge_block(channel_id=self.channel_id, organization=self.organization)
                is False
            )
        assert cache.get(cache_key(self.channel_id)) is None

    @with_feature(FEATURE_FLAG)
    def test_cache_limit_reached(self) -> None:
        # Already posted the max number of times for this channel this week.
        cache.set(cache_key(self.channel_id), 4, timeout=7 * 24 * 60 * 60)
        assert (
            should_send_nudge_block(channel_id=self.channel_id, organization=self.organization)
            is False
        )
        # Count is untouched (not incremented past the limit).
        assert cache.get(cache_key(self.channel_id)) == 4

    @with_feature(FEATURE_FLAG)
    def test_posts_block(self) -> None:
        assert cache.get(cache_key(self.channel_id)) is None
        assert (
            should_send_nudge_block(channel_id=self.channel_id, organization=self.organization)
            is True
        )
        # Posting seeds the per-channel weekly counter.
        assert cache.get(cache_key(self.channel_id)) == 1

    @with_feature(FEATURE_FLAG)
    def test_key_evicted_between_get_and_incr(self) -> None:
        # The cached count says we've posted before (so we take the incr branch),
        # but the key is evicted/expired before the incr runs. incr raises
        # ValueError on a missing key; we must fall back to set rather than
        # letting it propagate and drop the alert.
        cache.set(cache_key(self.channel_id), 2, timeout=7 * 24 * 60 * 60)
        with patch.object(cache, "incr", side_effect=ValueError("Key not found")):
            assert (
                should_send_nudge_block(channel_id=self.channel_id, organization=self.organization)
                is True
            )
        # The fallback re-seeded the counter at count + 1.
        assert cache.get(cache_key(self.channel_id)) == 3

    @with_feature(FEATURE_FLAG)
    def test_limit_is_per_channel(self) -> None:
        # A different channel has hit the limit this week...
        other_channel_id = "C9999999999"
        cache.set(cache_key(other_channel_id), 4, timeout=7 * 24 * 60 * 60)

        # ...but that must not block our channel (limit is per channel, not per org).
        assert (
            should_send_nudge_block(channel_id=self.channel_id, organization=self.organization)
            is True
        )
        assert cache.get(cache_key(self.channel_id)) == 1
        # The other channel's counter is unaffected.
        assert cache.get(cache_key(other_channel_id)) == 4
