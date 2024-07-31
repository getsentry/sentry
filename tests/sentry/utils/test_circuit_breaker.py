import time
from unittest.mock import MagicMock, patch

from django.core.cache import cache

from sentry.testutils.cases import TestCase
from sentry.utils.circuit_breaker import (
    ERROR_COUNT_CACHE_KEY,
    CircuitBreakerPassthrough,
    circuit_breaker_activated,
)


class TestCircuitBreaker(TestCase):
    def setUp(self):
        self.key = "test"
        self.error_limit = 5
        self.passthrough_data = CircuitBreakerPassthrough(limit=2, window=1)
        cache.set(ERROR_COUNT_CACHE_KEY(self.key), self.error_limit)

    def test_not_activated(self):
        assert not circuit_breaker_activated(self.key, self.error_limit + 1)

    def test_activated_at_error_limit(self):
        assert circuit_breaker_activated(key=self.key, error_limit=self.error_limit)

    @patch("sentry.utils.circuit_breaker.metrics.incr")
    def test_passthrough(self, mock_metrics: MagicMock):
        assert not circuit_breaker_activated(self.key, self.error_limit, self.passthrough_data)
        mock_metrics.assert_called_with(f"circuit_breaker.{self.key}.bypassed")

        assert not circuit_breaker_activated(self.key, self.error_limit, self.passthrough_data)
        mock_metrics.assert_called_with(f"circuit_breaker.{self.key}.bypassed")

        assert circuit_breaker_activated(self.key, self.error_limit, self.passthrough_data)
        mock_metrics.assert_called_with(f"circuit_breaker.{self.key}.throttled")

        # Wait for the passthrough window to expire and try again
        time.sleep(1)
        assert not circuit_breaker_activated(self.key, self.error_limit, self.passthrough_data)
        mock_metrics.assert_called_with(f"circuit_breaker.{self.key}.bypassed")
