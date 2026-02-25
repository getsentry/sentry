from __future__ import annotations

from unittest import mock

import pytest
from google.protobuf.wrappers_pb2 import Int32Value, StringValue

from sentry.billing.platform.core import BillingService, service_method


class TestBillingService:
    """Tests for the BillingService base class."""

    def test_init_no_arguments(self):
        """BillingService should be instantiable with no arguments."""
        service = BillingService()
        assert service is not None

    def test_inheritance(self):
        """Services should be able to inherit from BillingService."""

        class TestService(BillingService):
            pass

        service = TestService()
        assert isinstance(service, BillingService)
        assert isinstance(service, TestService)


class TestServiceMethod:
    """Tests for the @service_method decorator."""

    def test_basic_service_method(self):
        """Service methods should accept and return protobuf messages."""

        class TestService(BillingService):
            @service_method
            def echo_string(self, request: StringValue) -> StringValue:
                return StringValue(value=request.value)

        service = TestService()
        request = StringValue(value="hello")
        response = service.echo_string(request)

        assert isinstance(response, StringValue)
        assert response.value == "hello"

    def test_service_method_with_transformation(self):
        """Service methods can transform data."""

        class TestService(BillingService):
            @service_method
            def double_number(self, request: Int32Value) -> Int32Value:
                return Int32Value(value=request.value * 2)

        service = TestService()
        request = Int32Value(value=5)
        response = service.double_number(request)

        assert isinstance(response, Int32Value)
        assert response.value == 10

    def test_service_method_validates_input_type(self):
        """Service methods should raise TypeError if input is not a protobuf message."""

        class TestService(BillingService):
            @service_method
            def process(self, request: StringValue) -> StringValue:
                return StringValue(value="ok")

        service = TestService()

        with pytest.raises(TypeError, match="expects a protobuf Message"):
            service.process("not a protobuf")

        with pytest.raises(TypeError, match="expects a protobuf Message"):
            service.process({"key": "value"})

    def test_service_method_validates_return_type(self):
        """Service methods should raise TypeError if return value is not a protobuf message."""

        class TestService(BillingService):
            @service_method
            def bad_return(self, request: StringValue) -> StringValue:
                return "not a protobuf"

        service = TestService()
        request = StringValue(value="test")

        with pytest.raises(TypeError, match="must return a protobuf Message"):
            service.bad_return(request)

    @mock.patch("sentry.billing.platform.core.service.logger")
    def test_service_method_logs_start(self, mock_logger):
        """Service methods should log when they start."""

        class TestService(BillingService):
            @service_method
            def test_method(self, request: StringValue) -> StringValue:
                return StringValue(value="ok")

        service = TestService()
        request = StringValue(value="test")
        service.test_method(request)

        # Check that info was called with start log
        calls = [call for call in mock_logger.info.call_args_list if "start" in str(call)]
        assert len(calls) > 0

        start_call = calls[0]
        assert "billing.service.method.start" in str(start_call)
        extra = start_call[1]["extra"]
        assert extra["service"] == "TestService"
        assert extra["method"] == "test_method"
        assert extra["request_type"] == "StringValue"

    @mock.patch("sentry.billing.platform.core.service.logger")
    def test_service_method_logs_success(self, mock_logger):
        """Service methods should log success with duration."""

        class TestService(BillingService):
            @service_method
            def test_method(self, request: StringValue) -> StringValue:
                return StringValue(value="ok")

        service = TestService()
        request = StringValue(value="test")
        service.test_method(request)

        # Check that info was called with success log
        calls = [call for call in mock_logger.info.call_args_list if "success" in str(call)]
        assert len(calls) > 0

        success_call = calls[0]
        assert "billing.service.method.success" in str(success_call)
        extra = success_call[1]["extra"]
        assert extra["service"] == "TestService"
        assert extra["method"] == "test_method"
        assert extra["response_type"] == "StringValue"
        assert "duration_ms" in extra
        assert isinstance(extra["duration_ms"], float)

    @mock.patch("sentry.billing.platform.core.service.logger")
    def test_service_method_logs_error(self, mock_logger):
        """Service methods should log errors with details."""

        class TestService(BillingService):
            @service_method
            def failing_method(self, request: StringValue) -> StringValue:
                raise ValueError("Something went wrong")

        service = TestService()
        request = StringValue(value="test")

        with pytest.raises(ValueError, match="Something went wrong"):
            service.failing_method(request)

        # Check that exception was called with error log
        mock_logger.exception.assert_called_once()
        call_args = mock_logger.exception.call_args
        assert "billing.service.method.error" in str(call_args)
        extra = call_args[1]["extra"]
        assert extra["service"] == "TestService"
        assert extra["method"] == "failing_method"
        assert extra["error"] == "Something went wrong"
        assert extra["error_type"] == "ValueError"
        assert "duration_ms" in extra

    def test_service_method_preserves_function_name(self):
        """The decorator should preserve the original function name."""

        class TestService(BillingService):
            @service_method
            def my_custom_method(self, request: StringValue) -> StringValue:
                return StringValue(value="ok")

        service = TestService()
        assert service.my_custom_method.__name__ == "my_custom_method"

    def test_service_method_allows_exceptions_to_propagate(self):
        """Exceptions from service methods should propagate to the caller."""

        class CustomError(Exception):
            pass

        class TestService(BillingService):
            @service_method
            def failing_method(self, request: StringValue) -> StringValue:
                raise CustomError("Custom error occurred")

        service = TestService()
        request = StringValue(value="test")

        with pytest.raises(CustomError, match="Custom error occurred"):
            service.failing_method(request)


class TestServiceIntegration:
    """Integration tests demonstrating real-world service usage patterns."""

    def test_multiple_methods_on_same_service(self):
        """A service can have multiple service methods."""

        class UserService(BillingService):
            @service_method
            def get_user_name(self, request: Int32Value) -> StringValue:
                # In real implementation, would fetch from database
                return StringValue(value=f"User {request.value}")

            @service_method
            def get_user_count(self, request: StringValue) -> Int32Value:
                # In real implementation, would query database
                return Int32Value(value=42)

        service = UserService()

        name_response = service.get_user_name(Int32Value(value=123))
        assert name_response.value == "User 123"

        count_response = service.get_user_count(StringValue(value="organization_1"))
        assert count_response.value == 42

    def test_service_can_be_instantiated_multiple_times(self):
        """Services should be stateless and instantiable multiple times."""

        class CounterService(BillingService):
            @service_method
            def get_count(self, request: StringValue) -> Int32Value:
                return Int32Value(value=1)

        service1 = CounterService()
        service2 = CounterService()

        result1 = service1.get_count(StringValue(value="test"))
        result2 = service2.get_count(StringValue(value="test"))

        assert result1.value == result2.value == 1
        assert service1 is not service2

    def test_service_uniform_construction(self):
        """All services should be constructible with no arguments."""

        class ServiceA(BillingService):
            @service_method
            def method_a(self, request: StringValue) -> StringValue:
                return StringValue(value="A")

        class ServiceB(BillingService):
            @service_method
            def method_b(self, request: StringValue) -> StringValue:
                return StringValue(value="B")

        # Both services should be instantiable the same way
        service_a = ServiceA()
        service_b = ServiceB()

        assert service_a.method_a(StringValue(value="test")).value == "A"
        assert service_b.method_b(StringValue(value="test")).value == "B"

    def test_example_from_intention_doc(self):
        """
        This test demonstrates the example pattern from INTENTION.md.

        In a real implementation, GetContractRequest and GetContractResponse
        would be actual protobuf definitions. We use wrapper types here
        for demonstration purposes.
        """

        class ContractService(BillingService):
            @service_method
            def get_contract(self, request: Int32Value) -> StringValue:
                # In real implementation, would fetch contract from database
                # request.value represents organization_id
                contract_id = f"contract_for_org_{request.value}"
                return StringValue(value=contract_id)

        # Usage pattern from INTENTION.md:
        # contract_proto = ContractService().get_contract(GetContractRequest(organization_id=1))
        contract_proto = ContractService().get_contract(Int32Value(value=1))

        assert isinstance(contract_proto, StringValue)
        assert contract_proto.value == "contract_for_org_1"
