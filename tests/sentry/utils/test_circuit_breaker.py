from unittest.mock import patch

from django.core.cache import cache

from sentry.testutils.cases import TestCase
from sentry.utils.circuit_breaker import ERROR_COUNT_CACHE_KEY, circuit_breaker_activated


class TestCircuitBreaker(TestCase):
    def setUp(self):
        self.key = "test"
        self.error_limit = 5
        self.passthrough_data = [2, 1]
        cache.set(ERROR_COUNT_CACHE_KEY(self.key), self.error_limit)

    def test_not_activated(self):
        assert not circuit_breaker_activated(self.key, self.error_limit + 1)

    def test_activated_at_error_limit(self):
        assert circuit_breaker_activated(key=self.key, error_limit=self.error_limit)

    def test_passthrough(self):
        assert not circuit_breaker_activated(self.key, self.error_limit, self.passthrough_data)
        assert not circuit_breaker_activated(self.key, self.error_limit, self.passthrough_data)
        assert circuit_breaker_activated(self.key, self.error_limit, self.passthrough_data)

    @patch("sentry.ratelimits.backend.is_limited", return_value=True)
    def test_passthrough_limit_exceeded(self, mock_is_limited):
        assert circuit_breaker_activated(self.key, self.error_limit, self.passthrough_data)
        assert mock_is_limited.call_count == 1
