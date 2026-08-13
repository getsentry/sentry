from django.conf import settings

from sentry.scm.private.rate_limit import (
    RedisRateLimitProvider,
    WindowState,
    total_limit_key,
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
        self.total_key = total_limit_key("github", self.organization.id)
        self.window_key = window_state_key("github", self.organization.id)
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


class TestRedisRateLimitProviderIncrUsage(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.provider = RedisRateLimitProvider()
        self.usage_key = usage_count_key("github", self.organization.id, 1000, "shared")
        _client().delete(self.usage_key)

    def test_returns_one_on_first_call(self) -> None:
        assert self.provider.incr_usage(self.usage_key, expiration=60) == 1

    def test_increments_usage_on_each_call(self) -> None:
        self.provider.incr_usage(self.usage_key, expiration=60)
        self.provider.incr_usage(self.usage_key, expiration=60)
        assert self.provider.incr_usage(self.usage_key, expiration=60) == 3

    def test_usage_key_has_ttl_set(self) -> None:
        self.provider.incr_usage(self.usage_key, expiration=60)
        ttl = _client().ttl(self.usage_key)
        assert 0 < ttl <= 60


class TestRedisRateLimitProviderSetWindowState(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.provider = RedisRateLimitProvider()
        self.window_key = window_state_key("github", self.organization.id)
        _client().delete(self.window_key)

    def test_writes_window_state_with_ttl(self) -> None:
        self.provider.set_window_state(self.window_key, WindowState(used=42, reset=1600), 600)
        assert _client().get(self.window_key) == "42:1600"
        assert 0 < _client().ttl(self.window_key) <= 600

    def test_overwrites_existing_window_state(self) -> None:
        self.provider.set_window_state(self.window_key, WindowState(used=1, reset=1600), 600)
        self.provider.set_window_state(self.window_key, WindowState(used=99, reset=1600), 600)
        assert _client().get(self.window_key) == "99:1600"


class TestWindowStateExpiresWithTheProviderWindow(TestCase):
    """
    The window state key carries the provider's reset instant, so it must not outlive the window it
    describes. A stale report would charge the next window for the previous one's usage.
    """

    def setUp(self) -> None:
        super().setUp()
        self.provider = RedisRateLimitProvider()
        self.total_key = total_limit_key("github", self.organization.id)
        self.window_key = window_state_key("github", self.organization.id)
        client = _client()
        client.delete(self.total_key)
        client.delete(self.window_key)

    def test_expired_window_state_is_not_returned(self) -> None:
        self.provider.set_window_state(self.window_key, WindowState(used=42, reset=1600), 600)
        _client().delete(self.window_key)
        _, window = self.provider.get_rate_limit_state(self.total_key, self.window_key)
        assert window is None


class TestRedisRateLimitProviderGetAccountedUsage(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.provider = RedisRateLimitProvider()
        self.keys = [
            usage_count_key("github", self.organization.id, 1000, "emerge"),
            usage_count_key("github", self.organization.id, 1000, "autofix"),
        ]
        client = _client()
        for key in self.keys:
            client.delete(key)

    def test_returns_zero_for_missing_keys(self) -> None:
        assert self.provider.get_accounted_usage(self.keys) == 0

    def test_returns_zero_for_empty_keys(self) -> None:
        assert self.provider.get_accounted_usage([]) == 0

    def test_sums_existing_keys(self) -> None:
        client = _client()
        client.set(self.keys[0], 10)
        client.set(self.keys[1], 25)
        assert self.provider.get_accounted_usage(self.keys) == 35

    def test_ignores_missing_keys_in_sum(self) -> None:
        _client().set(self.keys[0], 7)
        assert self.provider.get_accounted_usage(self.keys) == 7


class TestRedisRateLimitProviderSetKeyValues(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.provider = RedisRateLimitProvider()
        self.limit_key = total_limit_key("github", self.organization.id)
        self.usage_key = usage_count_key("github", self.organization.id, 1000, "shared")
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
