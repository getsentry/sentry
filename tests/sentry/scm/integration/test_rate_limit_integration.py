from django.conf import settings

from sentry.scm.private.rate_limit import RedisRateLimitProvider, total_limit_key, usage_count_key
from sentry.testutils.cases import TestCase
from sentry.utils import redis


def _client():
    return redis.redis_clusters.get(settings.SENTRY_SCM_REDIS_CLUSTER)


class TestRedisRateLimitProviderGetAndSet(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.provider = RedisRateLimitProvider()
        self.total_key = total_limit_key("github", self.organization.id, "default")
        self.usage_key = usage_count_key("github", self.organization.id, 1000, "shared", "default")
        client = _client()
        client.delete(self.total_key)
        client.delete(self.usage_key)

    def test_returns_none_limit_when_total_key_missing(self) -> None:
        limit, usage = self.provider.get_and_set_rate_limit(
            self.total_key, self.usage_key, expiration=60
        )
        assert limit is None
        assert usage == 1

    def test_returns_limit_when_total_key_set(self) -> None:
        _client().set(self.total_key, 500)
        limit, usage = self.provider.get_and_set_rate_limit(
            self.total_key, self.usage_key, expiration=60
        )
        assert limit == 500
        assert usage == 1

    def test_increments_usage_on_each_call(self) -> None:
        _client().set(self.total_key, 100)
        self.provider.get_and_set_rate_limit(self.total_key, self.usage_key, expiration=60)
        self.provider.get_and_set_rate_limit(self.total_key, self.usage_key, expiration=60)
        _, usage = self.provider.get_and_set_rate_limit(
            self.total_key, self.usage_key, expiration=60
        )
        assert usage == 3

    def test_usage_key_has_ttl_set(self) -> None:
        self.provider.get_and_set_rate_limit(self.total_key, self.usage_key, expiration=60)
        ttl = _client().ttl(self.usage_key)
        assert 0 < ttl <= 60


class TestRedisRateLimitProviderGetAccountedUsage(TestCase):
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
    GitHub meters `core` (>=5000/hour) and `search` (30/minute) independently. Their capacities and
    counters must land on distinct Redis keys, otherwise a search response overwrites the core
    limit and every subsequent core request looks rate limited.
    """

    def setUp(self) -> None:
        super().setUp()
        self.provider = RedisRateLimitProvider()
        self.core_limit_key = total_limit_key("github", self.organization.id, "core")
        self.search_limit_key = total_limit_key("github", self.organization.id, "search")
        self.core_usage_key = usage_count_key(
            "github", self.organization.id, 1000, "shared", "core"
        )
        self.search_usage_key = usage_count_key(
            "github", self.organization.id, 1000, "shared", "search"
        )
        client = _client()
        for key in (
            self.core_limit_key,
            self.search_limit_key,
            self.core_usage_key,
            self.search_usage_key,
        ):
            client.delete(key)

    def test_resource_keys_are_distinct(self) -> None:
        assert self.core_limit_key != self.search_limit_key
        assert self.core_usage_key != self.search_usage_key

    def test_capacity_writes_do_not_collide(self) -> None:
        self.provider.set_key_values({self.core_limit_key: (5000, None)})
        self.provider.set_key_values({self.search_limit_key: (30, None)})

        core_limit, _ = self.provider.get_and_set_rate_limit(
            self.core_limit_key, self.core_usage_key, expiration=3600
        )
        search_limit, _ = self.provider.get_and_set_rate_limit(
            self.search_limit_key, self.search_usage_key, expiration=60
        )
        assert core_limit == 5000
        assert search_limit == 30

    def test_usage_counters_do_not_collide(self) -> None:
        for _ in range(5):
            self.provider.get_and_set_rate_limit(
                self.core_limit_key, self.core_usage_key, expiration=3600
            )

        _, search_usage = self.provider.get_and_set_rate_limit(
            self.search_limit_key, self.search_usage_key, expiration=60
        )
        assert search_usage == 1
