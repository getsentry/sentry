from __future__ import annotations

from unittest import mock

import pytest
from google.protobuf.wrappers_pb2 import Int32Value, StringValue

from sentry.billing.platform.core import BillingService, service_method
from sentry.billing.platform.core.service import (
    _effective_sample_rate,
    _propagate_sample_rate,
    _should_log_trace,
)


class TestBillingService:
    """Tests for the BillingService base class and service_method decorator."""

    def test_service_inheritance_and_basic_method(self) -> None:
        """Services inherit from BillingService and methods accept/return protobufs."""

        class TestService(BillingService):
            @service_method
            def echo_string(self, request: StringValue) -> StringValue:
                return StringValue(value=request.value)

        service = TestService()
        assert isinstance(service, BillingService)

        response = service.echo_string(StringValue(value="hello"))
        assert isinstance(response, StringValue)
        assert response.value == "hello"

    def test_service_method_validates_input_type(self) -> None:
        """Service methods reject non-protobuf input."""

        class TestService(BillingService):
            @service_method
            def process(self, request: StringValue) -> StringValue:
                return StringValue(value="ok")

        service = TestService()

        with pytest.raises(TypeError, match="expects a protobuf Message"):
            service.process("not a protobuf")  # type: ignore[arg-type]

    def test_service_method_validates_return_type(self) -> None:
        """Service methods reject non-protobuf return values."""

        class TestService(BillingService):
            @service_method
            def bad_return(self, request: StringValue) -> StringValue:
                return "not a protobuf"  # type: ignore[return-value]

        service = TestService()

        with pytest.raises(TypeError, match="must return a protobuf Message"):
            service.bad_return(StringValue(value="test"))

    @mock.patch("sentry.billing.platform.core.service.metrics")
    @mock.patch("sentry.billing.platform.core.service.logger")
    @mock.patch("sentry.billing.platform.core.service._should_log_trace", return_value=True)
    def test_service_method_observability(self, mock_should_log, mock_logger, mock_metrics):
        """Service methods emit metrics and logs."""

        class TestService(BillingService):
            @service_method
            def test_method(self, request: StringValue) -> StringValue:
                return StringValue(value="ok")

        service = TestService()
        service.test_method(StringValue(value="test"))

        # Verify metrics were called
        mock_metrics.incr.assert_any_call(
            "billing.service.method.called",
            tags={"service": "TestService", "method": "test_method"},
            sample_rate=1.0,
        )
        mock_metrics.incr.assert_any_call(
            "billing.service.method.success",
            tags={"service": "TestService", "method": "test_method"},
            sample_rate=1.0,
        )
        mock_metrics.timing.assert_called()

        # Verify logging
        assert mock_logger.info.call_count == 1

    @mock.patch("sentry.billing.platform.core.service.metrics")
    @mock.patch("sentry.billing.platform.core.service.logger")
    def test_service_method_skips_success_log_when_not_sampled(self, mock_logger, mock_metrics):
        """Success logs are skipped when trace is not sampled."""

        class TestService(BillingService):
            @service_method(trace_log_sample_rate=0)
            def test_method(self, request: StringValue) -> StringValue:
                return StringValue(value="ok")

        service = TestService()
        service.test_method(StringValue(value="test"))

        # Metrics are still emitted
        mock_metrics.incr.assert_any_call(
            "billing.service.method.success",
            tags={"service": "TestService", "method": "test_method"},
            sample_rate=1.0,
        )

        # But no success log
        mock_logger.info.assert_not_called()

    @mock.patch("sentry.billing.platform.core.service.metrics")
    def test_service_method_error_handling(self, mock_metrics):
        """Service methods propagate exceptions and emit error metrics."""

        class TestService(BillingService):
            @service_method
            def failing_method(self, request: StringValue) -> StringValue:
                raise ValueError("Something went wrong")

        service = TestService()

        with pytest.raises(ValueError, match="Something went wrong"):
            service.failing_method(StringValue(value="test"))

        # Verify error metrics
        mock_metrics.incr.assert_any_call(
            "billing.service.method.error",
            tags={
                "service": "TestService",
                "method": "failing_method",
                "error_type": "ValueError",
            },
            sample_rate=1.0,
        )

    def test_multiple_methods_on_same_service(self) -> None:
        """A service can have multiple service methods."""

        class UserService(BillingService):
            @service_method
            def get_user_name(self, request: Int32Value) -> StringValue:
                return StringValue(value=f"User {request.value}")

            @service_method
            def get_user_count(self, request: StringValue) -> Int32Value:
                return Int32Value(value=42)

        service = UserService()

        assert service.get_user_name(Int32Value(value=123)).value == "User 123"
        assert service.get_user_count(StringValue(value="org_1")).value == 42


class TestShouldLogTrace:
    """Tests for the _should_log_trace sampling logic."""

    @mock.patch("sentry.billing.platform.core.service._get_trace_hash", return_value=None)
    def test_returns_false_when_no_trace_id(self, mock_hash):
        with _propagate_sample_rate(1.0):
            assert _should_log_trace() is False

    @mock.patch("sentry.billing.platform.core.service._get_trace_hash", return_value=50)
    def test_logs_when_hash_below_threshold(self, mock_hash):
        with _propagate_sample_rate(0.01):  # threshold = 100
            assert _should_log_trace() is True

    @mock.patch("sentry.billing.platform.core.service._get_trace_hash", return_value=500)
    def test_skips_when_hash_above_threshold(self, mock_hash):
        with _propagate_sample_rate(0.01):  # threshold = 100
            assert _should_log_trace() is False


class TestEffectiveSampleRatePropagation:
    """Tests for ContextVar-based sample rate propagation across nested service methods."""

    @mock.patch("sentry.billing.platform.core.service._get_trace_hash", return_value=9999)
    @mock.patch("sentry.billing.platform.core.service.metrics")
    def test_parent_rate_propagates_to_child(self, mock_metrics, mock_hash):
        """A child method inherits the parent's higher effective sample rate."""
        captured_rates: list[float] = []

        class TestService(BillingService):
            @service_method(trace_log_sample_rate=0.01)
            def parent_method(self, request: StringValue) -> StringValue:
                captured_rates.append(_effective_sample_rate.get(0.0))
                return self.child_method(request)

            @service_method(trace_log_sample_rate=0.001)
            def child_method(self, request: StringValue) -> StringValue:
                captured_rates.append(_effective_sample_rate.get(0.0))
                return StringValue(value="ok")

        service = TestService()
        service.parent_method(StringValue(value="test"))

        assert captured_rates[0] == 0.01  # parent's own rate
        assert captured_rates[1] == 0.01  # child inherited parent's higher rate

    @mock.patch("sentry.billing.platform.core.service._get_trace_hash", return_value=9999)
    @mock.patch("sentry.billing.platform.core.service.metrics")
    def test_child_higher_rate_takes_precedence(self, mock_metrics, mock_hash):
        """A child with a higher rate than the parent uses its own rate."""
        captured_rates: list[float] = []

        class TestService(BillingService):
            @service_method(trace_log_sample_rate=0.001)
            def parent_method(self, request: StringValue) -> StringValue:
                captured_rates.append(_effective_sample_rate.get(0.0))
                return self.child_method(request)

            @service_method(trace_log_sample_rate=0.01)
            def child_method(self, request: StringValue) -> StringValue:
                captured_rates.append(_effective_sample_rate.get(0.0))
                return StringValue(value="ok")

        service = TestService()
        service.parent_method(StringValue(value="test"))

        assert captured_rates[0] == 0.001  # parent's own rate
        assert captured_rates[1] == 0.01  # child's higher rate wins

    @mock.patch("sentry.billing.platform.core.service._get_trace_hash", return_value=9999)
    @mock.patch("sentry.billing.platform.core.service.metrics")
    def test_effective_rate_resets_after_method_returns(self, mock_metrics, mock_hash):
        """The effective rate is restored after a method returns, so siblings
        don't inherit each other's rates."""
        captured_rates: list[float] = []

        class TestService(BillingService):
            @service_method(trace_log_sample_rate=0.001)
            def parent_method(self, request: StringValue) -> StringValue:
                self.high_rate_child(request)
                # After high_rate_child returns, rate should be restored
                captured_rates.append(_effective_sample_rate.get(0.0))
                self.low_rate_sibling(request)
                return StringValue(value="ok")

            @service_method(trace_log_sample_rate=0.1)
            def high_rate_child(self, request: StringValue) -> StringValue:
                return StringValue(value="ok")

            @service_method(trace_log_sample_rate=0.0001)
            def low_rate_sibling(self, request: StringValue) -> StringValue:
                captured_rates.append(_effective_sample_rate.get(0.0))
                return StringValue(value="ok")

        service = TestService()
        service.parent_method(StringValue(value="test"))

        # After high_rate_child returns, parent's rate should be restored
        assert captured_rates[0] == 0.001
        # low_rate_sibling should use parent's rate (0.001) since it's higher
        assert captured_rates[1] == 0.001
