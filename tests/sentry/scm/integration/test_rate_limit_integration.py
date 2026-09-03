from unittest import mock

import pytest
from django.conf import settings

from sentry.scm.private.rate_limit import (
    CUMULATIVE_USAGE_TTL_SECONDS,
    IndeterminateResult,
    RedisRateLimitProvider,
    WindowState,
    completed_usage_key,
    total_limit_key,
    total_usage_key,
    usage_count_key,
    window_state_key,
)
from sentry.testutils.cases import TestCase
from sentry.utils import redis


def _client():
    return redis.redis_clusters.get(settings.SENTRY_SCM_REDIS_CLUSTER)


class TestRedisRateLimitProviderGetRateLimitState(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.provider = RedisRateLimitProvider()
        self.total_key = total_limit_key("github", self.organization.id, "default")
        self.window_key = window_state_key("github", self.organization.id, "default")
        client = _client()
        client.delete(self.total_key)
        client.delete(self.window_key)

    def test_returns_none_limit_when_total_key_missing(self) -> None:
        limit, window = self.provider.get_rate_limit_state(self.total_key, self.window_key)
        assert limit is None
        assert window is None

    def test_returns_limit_when_total_key_set(self) -> None:
        _client().set(self.total_key, 500)
        limit, _ = self.provider.get_rate_limit_state(self.total_key, self.window_key)
        assert limit == 500

    def test_returns_window_state_when_set(self) -> None:
        self.provider.set_window_state(self.window_key, WindowState(used=42, reset=1600), 600)
        _, window = self.provider.get_rate_limit_state(self.total_key, self.window_key)
        assert window == WindowState(used=42, reset=1600)

    def test_returns_none_window_for_unparseable_value(self) -> None:
        _client().set(self.window_key, "garbage")
        _, window = self.provider.get_rate_limit_state(self.total_key, self.window_key)
        assert window is None

    def test_raises_indeterminate_result_for_unparseable_capacity(self) -> None:
        _client().set(self.total_key, "garbage")
        with pytest.raises(IndeterminateResult):
            self.provider.get_rate_limit_state(self.total_key, self.window_key)


class TestRedisRateLimitProviderIncrUsage(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.provider = RedisRateLimitProvider()
        self.usage_key = usage_count_key("github", self.organization.id, 1000, "shared", "default")
        self.total_usage_key = total_usage_key("github", self.organization.id, "shared", "default")
        _client().delete(self.usage_key, self.total_usage_key)

    def test_returns_one_on_first_call(self) -> None:
        assert self.provider.incr_usage(self.usage_key, self.total_usage_key, expiration=60) == (
            1,
            1,
        )

    def test_increments_usage_on_each_call(self) -> None:
        self.provider.incr_usage(self.usage_key, self.total_usage_key, expiration=60)
        self.provider.incr_usage(self.usage_key, self.total_usage_key, expiration=60)
        assert self.provider.incr_usage(self.usage_key, self.total_usage_key, expiration=60) == (
            3,
            3,
        )

    def test_usage_key_has_ttl_set(self) -> None:
        self.provider.incr_usage(self.usage_key, self.total_usage_key, expiration=60)
        ttl = _client().ttl(self.usage_key)
        assert 0 < ttl <= 60

    def test_total_usage_key_has_ttl_set(self) -> None:
        """
        The cumulative issued counter is compared against the completed counter by difference; it
        must not persist in Redis forever once an integration goes idle.
        """
        self.provider.incr_usage(self.usage_key, self.total_usage_key, expiration=60)
        ttl = _client().ttl(self.total_usage_key)
        assert 0 < ttl <= CUMULATIVE_USAGE_TTL_SECONDS


class TestRedisRateLimitProviderSetWindowState(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.provider = RedisRateLimitProvider()
        self.window_key = window_state_key("github", self.organization.id, "default")
        _client().delete(self.window_key)

    def test_writes_window_state_with_ttl(self) -> None:
        self.provider.set_window_state(
            self.window_key,
            WindowState(used=42, reset=1600, local_used=37, reserved_used=5),
            600,
        )
        assert _client().get(self.window_key) == "42:1600:37:5"
        assert 0 < _client().ttl(self.window_key) <= 600

    def test_overwrites_existing_window_state(self) -> None:
        self.provider.set_window_state(self.window_key, WindowState(used=1, reset=1600), 600)
        self.provider.set_window_state(self.window_key, WindowState(used=99, reset=1600), 600)
        assert _client().get(self.window_key) == "99:1600"

    def test_does_not_regress_usage_within_a_window(self) -> None:
        self.provider.set_window_state(self.window_key, WindowState(used=99, reset=1600), 600)
        self.provider.set_window_state(self.window_key, WindowState(used=1, reset=1600), 600)
        assert _client().get(self.window_key) == "99:1600"

    def test_newer_window_replaces_the_previous_window(self) -> None:
        self.provider.set_window_state(self.window_key, WindowState(used=99, reset=1600), 600)
        self.provider.set_window_state(self.window_key, WindowState(used=1, reset=5200), 600)
        assert _client().get(self.window_key) == "1:5200"

    def test_previous_window_cannot_replace_a_newer_window(self) -> None:
        self.provider.set_window_state(self.window_key, WindowState(used=1, reset=5200), 600)
        self.provider.set_window_state(self.window_key, WindowState(used=99, reset=1600), 600)
        assert _client().get(self.window_key) == "1:5200"

    def test_unparseable_existing_state_is_overwritten(self) -> None:
        _client().set(self.window_key, "garbage")
        self.provider.set_window_state(self.window_key, WindowState(used=1, reset=1600), 600)
        assert _client().get(self.window_key) == "1:1600"

    def test_write_failures_are_contained(self) -> None:
        """
        Cluster clients raise exceptions that are not `RedisError` subclasses. A failed write must
        never escape into the request path.
        """
        with mock.patch(
            "sentry.scm.private.rate_limit.set_window_state_script",
            side_effect=Exception("cluster says no"),
        ):
            self.provider.set_window_state(self.window_key, WindowState(used=1, reset=1600), 600)
        assert _client().get(self.window_key) is None


class TestRedisRateLimitProviderIncrCompletedUsage(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.provider = RedisRateLimitProvider()
        self.usage_key = completed_usage_key(
            "github", self.organization.id, 1600, "emerge", "default"
        )
        _client().delete(self.usage_key)

    def test_increments_completed_usage_with_ttl(self) -> None:
        self.provider.incr_completed_usage(self.usage_key, expiration=60)
        self.provider.incr_completed_usage(self.usage_key, expiration=60)
        assert _client().get(self.usage_key) == "2"
        assert 0 < _client().ttl(self.usage_key) <= 60


class TestWindowStateExpiresWithTheProviderWindow(TestCase):
    """
    The window state key carries the provider's reset instant, so it must not outlive the window it
    describes. A stale report would charge the next window for the previous one's usage.
    """

    def setUp(self) -> None:
        super().setUp()
        self.provider = RedisRateLimitProvider()
        self.total_key = total_limit_key("github", self.organization.id, "default")
        self.window_key = window_state_key("github", self.organization.id, "default")
        client = _client()
        client.delete(self.total_key)
        client.delete(self.window_key)

    def test_expired_window_state_is_not_returned(self) -> None:
        self.provider.set_window_state(self.window_key, WindowState(used=42, reset=1600), 600)
        _client().delete(self.window_key)
        _, window = self.provider.get_rate_limit_state(self.total_key, self.window_key)
        assert window is None


class TestRedisRateLimitProviderGetUsageCounts(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.provider = RedisRateLimitProvider()
        self.keys = [
            usage_count_key("github", self.organization.id, 1000, "emerge", "default"),
            usage_count_key("github", self.organization.id, 1000, "autofix", "default"),
        ]
        client = _client()
        for key in self.keys:
            client.delete(key)

    def test_returns_zero_for_missing_keys(self) -> None:
        assert self.provider.get_usage_counts(self.keys) == [0, 0]

    def test_returns_empty_for_empty_keys(self) -> None:
        assert self.provider.get_usage_counts([]) == []

    def test_returns_counts_per_key(self) -> None:
        client = _client()
        client.set(self.keys[0], 10)
        client.set(self.keys[1], 25)
        assert self.provider.get_usage_counts(self.keys) == [10, 25]

    def test_counts_missing_keys_as_zero(self) -> None:
        _client().set(self.keys[0], 7)
        assert self.provider.get_usage_counts(self.keys) == [7, 0]

    def test_raises_indeterminate_result_for_unparseable_counter(self) -> None:
        _client().set(self.keys[0], "garbage")
        with pytest.raises(IndeterminateResult):
            self.provider.get_usage_counts(self.keys)


class TestRedisRateLimitProviderSetKeyValues(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.provider = RedisRateLimitProvider()
        self.limit_key = total_limit_key("github", self.organization.id, "default")
        self.usage_key = usage_count_key("github", self.organization.id, 1000, "shared", "default")
        client = _client()
        client.delete(self.limit_key)
        client.delete(self.usage_key)

    def test_sets_persistent_key_without_ttl(self) -> None:
        self.provider.set_key_values({self.limit_key: (500, None)})
        client = _client()
        assert client.get(self.limit_key) == "500"
        assert client.ttl(self.limit_key) == -1

    def test_sets_usage_key_with_ttl(self) -> None:
        self.provider.set_key_values({self.usage_key: (10, 60)})
        client = _client()
        assert client.get(self.usage_key) == "10"
        assert 0 < client.ttl(self.usage_key) <= 60

    def test_sets_multiple_keys(self) -> None:
        self.provider.set_key_values(
            {
                self.limit_key: (200, None),
                self.usage_key: (15, 60),
            }
        )
        client = _client()
        assert client.get(self.limit_key) == "200"
        assert client.ttl(self.limit_key) == -1
        assert client.get(self.usage_key) == "15"
        assert 0 < client.ttl(self.usage_key) <= 60

    def test_overwrites_existing_value(self) -> None:
        _client().set(self.limit_key, 100)
        self.provider.set_key_values({self.limit_key: (999, None)})
        assert _client().get(self.limit_key) == "999"


class TestResourceKeyScoping(TestCase):
    """
    GitHub meters `core` (>=5000/hour) and `search` (30/minute) independently, each with its own
    limit, usage, and reset instant. Their capacities, counters, and window state must land on
    distinct Redis keys, otherwise a search response overwrites the core limit and every subsequent
    core request looks rate limited.
    """

    def setUp(self) -> None:
        super().setUp()
        self.provider = RedisRateLimitProvider()
        self.core_limit_key = total_limit_key("github", self.organization.id, "core")
        self.search_limit_key = total_limit_key("github", self.organization.id, "search")
        self.core_window_key = window_state_key("github", self.organization.id, "core")
        self.search_window_key = window_state_key("github", self.organization.id, "search")
        self.core_usage_key = usage_count_key(
            "github", self.organization.id, 1000, "shared", "core"
        )
        self.search_usage_key = usage_count_key(
            "github", self.organization.id, 1000, "shared", "search"
        )
        self.core_total_usage_key = total_usage_key(
            "github", self.organization.id, "shared", "core"
        )
        self.search_total_usage_key = total_usage_key(
            "github", self.organization.id, "shared", "search"
        )
        client = _client()
        for key in (
            self.core_limit_key,
            self.search_limit_key,
            self.core_window_key,
            self.search_window_key,
            self.core_usage_key,
            self.search_usage_key,
            self.core_total_usage_key,
            self.search_total_usage_key,
        ):
            client.delete(key)

    def test_resource_keys_are_distinct(self) -> None:
        assert self.core_limit_key != self.search_limit_key
        assert self.core_window_key != self.search_window_key
        assert self.core_usage_key != self.search_usage_key

    def test_capacity_writes_do_not_collide(self) -> None:
        self.provider.set_key_values({self.core_limit_key: (5000, None)})
        self.provider.set_key_values({self.search_limit_key: (30, None)})

        core_limit, _ = self.provider.get_rate_limit_state(
            self.core_limit_key, self.core_window_key
        )
        search_limit, _ = self.provider.get_rate_limit_state(
            self.search_limit_key, self.search_window_key
        )
        assert core_limit == 5000
        assert search_limit == 30

    def test_window_state_writes_do_not_collide(self) -> None:
        self.provider.set_window_state(self.core_window_key, WindowState(used=10, reset=4600), 600)
        self.provider.set_window_state(self.search_window_key, WindowState(used=29, reset=1060), 60)

        _, core_window = self.provider.get_rate_limit_state(
            self.core_limit_key, self.core_window_key
        )
        _, search_window = self.provider.get_rate_limit_state(
            self.search_limit_key, self.search_window_key
        )
        assert core_window == WindowState(used=10, reset=4600)
        assert search_window == WindowState(used=29, reset=1060)

    def test_usage_counters_do_not_collide(self) -> None:
        for _ in range(5):
            self.provider.incr_usage(
                self.core_usage_key, self.core_total_usage_key, expiration=3600
            )

        assert self.provider.incr_usage(
            self.search_usage_key, self.search_total_usage_key, expiration=60
        ) == (1, 1)
