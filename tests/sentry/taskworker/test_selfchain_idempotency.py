from unittest.mock import patch

from redis.exceptions import RedisError

from sentry.taskworker.selfchain_idempotency import already_spawned, mark_spawned
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options


class SelfChainIdempotencyTest(TestCase):
    def test_mark_then_already_spawned(self) -> None:
        assert already_spawned("merge_groups", "act-mark") is False

        mark_spawned("merge_groups", "act-mark")

        assert already_spawned("merge_groups", "act-mark") is True
        # A different activation id is unaffected.
        assert already_spawned("merge_groups", "act-other") is False
        # A different task key is unaffected (keys are namespaced by task).
        assert already_spawned("unmerge", "act-mark") is False

    def test_disabled_is_noop(self) -> None:
        with override_options({"taskworker.selfchain_idempotency.enabled": False}):
            mark_spawned("merge_groups", "act-disabled")
            assert already_spawned("merge_groups", "act-disabled") is False

        # With the guard re-enabled, the disabled run left no marker behind.
        assert already_spawned("merge_groups", "act-disabled") is False

    def test_fails_open_on_redis_error(self) -> None:
        with patch("sentry.taskworker.selfchain_idempotency.redis.redis_clusters.get") as mock_get:
            client = mock_get.return_value
            client.get.side_effect = RedisError("boom")
            client.set.side_effect = RedisError("boom")

            # Neither call raises; already_spawned fails open to False.
            assert already_spawned("merge_groups", "act-err") is False
            mark_spawned("merge_groups", "act-err")
