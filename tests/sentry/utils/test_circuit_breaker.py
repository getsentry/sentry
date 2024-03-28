from datetime import datetime, timedelta

from django.core.cache import cache

from sentry.testutils.cases import TestCase
from sentry.utils.circuit_breaker import (
    ERROR_COUNT_CACHE_KEY,
    PASSTHROUGH_COUNT_CACHE_KEY,
    circuit_breaker_activated,
)


class TestCircuitBreaker(TestCase):
    def setUp(self):
        self.key = "test"
        self.error_limit = 5
        self.passthrough_limit = 2
        cache.set(ERROR_COUNT_CACHE_KEY(self.key), self.error_limit)

    def test_not_activated(self):
        assert not circuit_breaker_activated(self.key, self.error_limit + 1)

    def test_activated_at_error_limit(self):
        assert circuit_breaker_activated(key=self.key, error_limit=self.error_limit)

    def test_passthrough(self):
        assert not circuit_breaker_activated(self.key, self.error_limit, self.passthrough_limit)
        assert not circuit_breaker_activated(self.key, self.error_limit, self.passthrough_limit)
        assert circuit_breaker_activated(self.key, self.error_limit, self.passthrough_limit)

    def test_passthrough_limit_exceeded(self):
        cache.set(
            PASSTHROUGH_COUNT_CACHE_KEY(self.key),
            (self.passthrough_limit, datetime.now()),
        )
        assert circuit_breaker_activated(self.key, self.error_limit, self.passthrough_limit)

    def test_passthrough_per_minute(self):
        cache.set(
            PASSTHROUGH_COUNT_CACHE_KEY(self.key),
            (self.passthrough_limit, datetime.now() - timedelta(seconds=61)),
        )

        assert not circuit_breaker_activated(self.key, self.error_limit, self.passthrough_limit)
