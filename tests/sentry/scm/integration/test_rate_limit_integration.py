from django.conf import settings

from sentry.scm.private.rate_limit import (
    get_accounted_usage,
    get_and_set_rate_limit,
    set_key_values,
    total_limit_key,
    usage_count_key,
)
from sentry.testutils.cases import TestCase
from sentry.utils import redis


def _client():
    return redis.redis_clusters.get(settings.SENTRY_SCM_REDIS_CLUSTER)


class TestGetAndSetRateLimit(TestCase):
    def setUp(self):
        super().setUp()
        self.total_key = total_limit_key("github", self.organization.id)
        self.usage_key = usage_count_key("github", self.organization.id, 1000, "shared")
        client = _client()
        client.delete(self.total_key)
        client.delete(self.usage_key)

    def test_returns_none_limit_when_total_key_missing(self):
        limit, usage = get_and_set_rate_limit(self.total_key, self.usage_key, expiration=60)
        assert limit is None
        assert usage == 1

    def test_returns_limit_when_total_key_set(self):
        _client().set(self.total_key, 500)
        limit, usage = get_and_set_rate_limit(self.total_key, self.usage_key, expiration=60)
        assert limit == 500
        assert usage == 1

    def test_increments_usage_on_each_call(self):
        _client().set(self.total_key, 100)
        get_and_set_rate_limit(self.total_key, self.usage_key, expiration=60)
        get_and_set_rate_limit(self.total_key, self.usage_key, expiration=60)
        _, usage = get_and_set_rate_limit(self.total_key, self.usage_key, expiration=60)
        assert usage == 3

    def test_usage_key_has_ttl_set(self):
        get_and_set_rate_limit(self.total_key, self.usage_key, expiration=60)
        ttl = _client().ttl(self.usage_key)
        assert 0 < ttl <= 60


class TestGetAccountedUsage(TestCase):
    def setUp(self):
        super().setUp()
        self.keys = [
            usage_count_key("github", self.organization.id, 1000, "emerge"),
            usage_count_key("github", self.organization.id, 1000, "autofix"),
        ]
        client = _client()
        for key in self.keys:
            client.delete(key)

    def test_returns_zero_for_missing_keys(self):
        assert get_accounted_usage(self.keys) == 0

    def test_returns_zero_for_empty_keys(self):
        assert get_accounted_usage([]) == 0

    def test_sums_existing_keys(self):
        client = _client()
        client.set(self.keys[0], 10)
        client.set(self.keys[1], 25)
        assert get_accounted_usage(self.keys) == 35

    def test_ignores_missing_keys_in_sum(self):
        _client().set(self.keys[0], 7)
        assert get_accounted_usage(self.keys) == 7


class TestSetKeyValues(TestCase):
    def setUp(self):
        super().setUp()
        self.limit_key = total_limit_key("github", self.organization.id)
        self.usage_key = usage_count_key("github", self.organization.id, 1000, "shared")
        client = _client()
        client.delete(self.limit_key)
        client.delete(self.usage_key)

    def test_sets_persistent_key_without_ttl(self):
        set_key_values({self.limit_key: (500, None)})
        client = _client()
        assert client.get(self.limit_key) == "500"
        assert client.ttl(self.limit_key) == -1

    def test_sets_usage_key_with_ttl(self):
        set_key_values({self.usage_key: (10, 60)})
        client = _client()
        assert client.get(self.usage_key) == "10"
        assert 0 < client.ttl(self.usage_key) <= 60

    def test_sets_multiple_keys(self):
        set_key_values(
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

    def test_overwrites_existing_value(self):
        _client().set(self.limit_key, 100)
        set_key_values({self.limit_key: (999, None)})
        assert _client().get(self.limit_key) == "999"
