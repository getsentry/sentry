import time
from unittest.mock import MagicMock, patch

from django.core.cache import cache

from sentry.utils.circuit_breaker import (
    ERROR_COUNT_CACHE_KEY,
    CircuitBreakerPassthrough,
    circuit_breaker_activated,
)

KEY = "test"
ERROR_LIMIT = 5


def test_circuit_breaker_not_activated() -> None:
    cache.set(ERROR_COUNT_CACHE_KEY(KEY), ERROR_LIMIT)
    assert not circuit_breaker_activated(KEY, ERROR_LIMIT + 1)


def test_circuit_breaker_activated_at_error_limit() -> None:
    cache.set(ERROR_COUNT_CACHE_KEY(KEY), ERROR_LIMIT)
    assert circuit_breaker_activated(key=KEY, error_limit=ERROR_LIMIT)


@patch("sentry.utils.circuit_breaker.metrics.incr")
def test_circuit_breaker_passthrough(mock_metrics: MagicMock) -> None:
    cache.set(ERROR_COUNT_CACHE_KEY(KEY), ERROR_LIMIT)
    passthrough_data = CircuitBreakerPassthrough(limit=2, window=1)

    assert not circuit_breaker_activated(KEY, ERROR_LIMIT, passthrough_data)
    mock_metrics.assert_called_with(f"circuit_breaker.{KEY}.bypassed")

    assert not circuit_breaker_activated(KEY, ERROR_LIMIT, passthrough_data)
    mock_metrics.assert_called_with(f"circuit_breaker.{KEY}.bypassed")

    assert circuit_breaker_activated(KEY, ERROR_LIMIT, passthrough_data)
    mock_metrics.assert_called_with(f"circuit_breaker.{KEY}.throttled")

    # Wait for the passthrough window to expire and try again
    time.sleep(1)
    assert not circuit_breaker_activated(KEY, ERROR_LIMIT, passthrough_data)
    mock_metrics.assert_called_with(f"circuit_breaker.{KEY}.bypassed")
