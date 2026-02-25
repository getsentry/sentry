from __future__ import annotations

from unittest import mock

import pytest
from google.protobuf.wrappers_pb2 import Int32Value, StringValue

from sentry.billing.platform.core import BillingService, service_method


class TestBillingService:
    """Tests for the BillingService base class and service_method decorator."""

    def test_service_inheritance_and_basic_method(self):
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

    def test_service_method_validates_input_type(self):
        """Service methods reject non-protobuf input."""

        class TestService(BillingService):
            @service_method
            def process(self, request: StringValue) -> StringValue:
                return StringValue(value="ok")

        service = TestService()

        with pytest.raises(TypeError, match="expects a protobuf Message"):
            service.process("not a protobuf")  # type: ignore[arg-type]

    def test_service_method_validates_return_type(self):
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
    def test_service_method_observability(self, mock_logger, mock_metrics):
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
        )
        mock_metrics.incr.assert_any_call(
            "billing.service.method.success",
            tags={"service": "TestService", "method": "test_method"},
        )
        mock_metrics.timing.assert_called()

        # Verify logging
        assert mock_logger.info.call_count == 2  # start and success

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
        )

    def test_multiple_methods_on_same_service(self):
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
