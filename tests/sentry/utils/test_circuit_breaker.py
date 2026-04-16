import time
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from django.core.cache import cache

from sentry.testutils.cases import TestCase
from sentry.utils.circuit_breaker import (
    ERROR_COUNT_CACHE_KEY,
    CircuitBreakerPassthrough,
    circuit_breaker_activated,
)


class TestCircuitBreaker(TestCase):
    def setUp(self) -> None:
        # Use a unique key per test so the Redis-backed passthrough ratelimiter
        # counter doesn't bleed between concurrent xdist workers.
        self.key = uuid4().hex
        self.error_limit = 5
        self.passthrough_data = CircuitBreakerPassthrough(limit=2, window=1)
        cache.set(ERROR_COUNT_CACHE_KEY(self.key), self.error_limit)

    def test_not_activated(self) -> None:
        assert not circuit_breaker_activated(self.key, self.error_limit + 1)

    def test_activated_at_error_limit(self) -> None:
        assert circuit_breaker_activated(key=self.key, error_limit=self.error_limit)

    @pytest.mark.skip(
        reason="test pollution: concurrent xdist worker's clear_caches fixture calls cache.clear() "
        "between passthrough calls 2 and 3, resetting the ratelimiter counter so call 3 "
        "returns False (bypass) instead of True (throttled)"
    )
    @patch("sentry.utils.circuit_breaker.metrics.incr")
    def test_passthrough(self, mock_metrics: MagicMock) -> None:
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
