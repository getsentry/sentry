import time
from unittest.mock import MagicMock, patch

import pytest
from django.core.cache import cache

from sentry.testutils.cases import TestCase
from sentry.utils.circuit_breaker import (
    ERROR_COUNT_CACHE_KEY,
    CircuitBreakerConfig,
    CircuitBreakerPassthrough,
    CircuitBreakerTripped,
    circuit_breaker_activated,
    with_circuit_breaker,
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


class FailedToFetchError(Exception):
    pass


class WithCircuitBreakerTest(TestCase):
    def setUp(self):
        self.key = "with_circuit_breaker_test"
        self.error_limit = 2
        self.error_limit_window = 3
        self.config = CircuitBreakerConfig(
            error_limit=self.error_limit,
            error_limit_window=self.error_limit_window,
            allow_passthrough=False,
            passthrough_interval=2,
            passthrough_attempts_per_interval=1,
        )
        self.error_count_key = ERROR_COUNT_CACHE_KEY(self.key)
        self.callback = MagicMock(wraps=lambda: "Dogs are great!")
        self.erroring_callback = MagicMock(
            side_effect=FailedToFetchError("Charlie didn't bring the ball back.")
        )

    def test_calls_callback_if_no_errors(self):
        assert cache.get_or_set(self.error_count_key, default=0) == 0

        result = with_circuit_breaker(self.key, self.callback, self.config)

        assert self.callback.call_count == 1
        assert result == "Dogs are great!"

    def test_calls_callback_if_not_too_many_errors(self):
        cache.set(self.error_count_key, self.error_limit - 1)

        result = with_circuit_breaker(self.key, self.callback, self.config)

        assert self.callback.call_count == 1
        assert result == "Dogs are great!"

    @patch("sentry.utils.circuit_breaker.metrics.incr")
    def test_prevents_next_request_if_breaker_is_tripped(self, mock_metrics_incr: MagicMock):
        cache.set(self.error_count_key, self.error_limit - 1)

        # The breaker hasn't been tripped yet, so the callback's error bubbles up
        with pytest.raises(FailedToFetchError):
            with_circuit_breaker(self.key, self.erroring_callback, self.config)

            assert self.erroring_callback.call_count == 1
            assert cache.get(self.error_count_key) == self.error_limit
            assert mock_metrics_incr.call_count == 0

        # Now the breaker has been flipped, so we get a circuit breaker error instead
        with pytest.raises(CircuitBreakerTripped):
            with_circuit_breaker(self.key, self.erroring_callback, self.config)

            assert self.erroring_callback.call_count == 1  # hasn't increased
            mock_metrics_incr.assert_called_with(f"circuit_breaker.{self.key}.throttled")

    @patch("sentry.utils.circuit_breaker.metrics.incr")
    def test_obeys_passthrough_config(self, mock_metrics_incr: MagicMock):
        cache.set(self.error_count_key, self.error_limit)

        # The passthrough is off by default, so the request is blocked and we get the circuit
        # breaker error
        with pytest.raises(CircuitBreakerTripped):
            with_circuit_breaker(self.key, self.erroring_callback, self.config)

            assert self.erroring_callback.call_count == 0
            mock_metrics_incr.assert_called_with(f"circuit_breaker.{self.key}.throttled")

        # Allowing passthrough causes the request to go through, so we get the callback's error this time
        self.config["allow_passthrough"] = True
        with pytest.raises(FailedToFetchError):
            with_circuit_breaker(self.key, self.erroring_callback, self.config)

            assert self.erroring_callback.call_count == 1
            mock_metrics_incr.assert_called_with(f"circuit_breaker.{self.key}.bypassed")

        # According to our config (see `setUp`), even with passthrough on, we only get one attempt
        # every two seconds, so now we're back to getting the circuit breaker error
        with pytest.raises(CircuitBreakerTripped):
            with_circuit_breaker(self.key, self.erroring_callback, self.config)

            assert self.erroring_callback.call_count == 1  # hasn't increased
            mock_metrics_incr.assert_called_with(f"circuit_breaker.{self.key}.throttled")

        # But if we wait the requisite two seconds, we're allowed another attempt, and we get the
        # callback's error again
        time.sleep(2)
        with pytest.raises(FailedToFetchError):
            with_circuit_breaker(self.key, self.erroring_callback, self.config)

            assert self.erroring_callback.call_count == 2
            mock_metrics_incr.assert_called_with(f"circuit_breaker.{self.key}.bypassed")

    @patch("sentry.utils.circuit_breaker.metrics.incr")
    def test_resets_on_successful_request(self, mock_metrics_incr: MagicMock):
        cache.set(self.error_count_key, self.error_limit)
        self.config["allow_passthrough"] = True

        # Passthrough lets this request through
        result = with_circuit_breaker(self.key, self.callback, self.config)

        assert self.callback.call_count == 1
        mock_metrics_incr.assert_called_with(f"circuit_breaker.{self.key}.bypassed")
        assert result == "Dogs are great!"

        # Error count is reset
        assert cache.get_or_set(self.error_count_key, default=0) == 0

    @patch("sentry.utils.circuit_breaker.metrics.incr")
    def resets_after_error_window(self, mock_metrics_incr: MagicMock):
        cache.set(self.error_count_key, self.error_limit)

        with pytest.raises(CircuitBreakerTripped):
            with_circuit_breaker(self.key, self.callback, self.config)

            assert self.callback.call_count == 0
            mock_metrics_incr.assert_called_with(f"circuit_breaker.{self.key}.throttled")

        time.sleep(self.error_limit_window)

        assert cache.get_or_set(self.error_count_key, default=0) == 0

        # Now requests go through
        result = with_circuit_breaker(self.key, self.callback, self.config)

        assert self.callback.call_count == 1
        assert result == "Dogs are great!"
