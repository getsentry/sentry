from __future__ import annotations

import functools
import logging
import time
from collections.abc import Callable
from typing import Any, TypeVar

from google.protobuf.message import Message

from sentry.utils import metrics

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=Message)
R = TypeVar("R", bound=Message)


class BillingService:
    """
    Base class for all billing services.

    Each service should inherit from this class and define service methods
    decorated with @service_method. Service methods must accept protobuf
    messages as input and return protobuf messages as output.

    Example:
        class ContractService(BillingService):
            @service_method
            def get_contract(self, request: GetContractRequest) -> GetContractResponse:
                # implementation here
                pass

        contract = ContractService().get_contract(GetContractRequest(organization_id=1))

    Key characteristics:
    1. No __init__ arguments - all services should be uniform
    2. Service methods are decorated with @service_method for observability
    3. All interfaces use protobuf input/output
    4. Services should not import across service boundaries
    """

    def __init__(self) -> None:
        """
        Initialize the billing service.

        Services should have no __init__ arguments to maintain uniformity.
        """
        pass


def service_method(func: Callable[[Any, T], R]) -> Callable[[Any, T], R]:
    """
    Decorator for billing service methods.

    Provides base functionality for service endpoints including:
    - Metrics collection
    - Observability/logging
    - Error handling
    - Request/response validation

    The decorated method should accept a protobuf request and return a protobuf response.

    Example:
        @service_method
        def get_contract(self, request: GetContractRequest) -> GetContractResponse:
            pass
    """

    @functools.wraps(func)
    def wrapper(self: BillingService, request: T) -> R:
        service_name = self.__class__.__name__
        method_name = func.__name__
        metric_tags = {"service": service_name, "method": method_name}

        # Validate input is a protobuf message
        if not isinstance(request, Message):
            raise TypeError(
                f"{service_name}.{method_name} expects a protobuf Message, "
                f"got {type(request).__name__}"
            )

        start_time = time.time()

        metrics.incr("billing.service.method.called", tags=metric_tags)

        try:
            logger.info(
                "billing.service.method.start",
                extra={
                    "service": service_name,
                    "method": method_name,
                    "request_type": type(request).__name__,
                },
            )

            result = func(self, request)

            # Validate output is a protobuf message
            if not isinstance(result, Message):
                raise TypeError(
                    f"{service_name}.{method_name} must return a protobuf Message, "
                    f"returned {type(result).__name__}"
                )

            duration_ms = (time.time() - start_time) * 1000

            metrics.timing("billing.service.method.duration", duration_ms, tags=metric_tags)
            metrics.incr("billing.service.method.success", tags=metric_tags)

            logger.info(
                "billing.service.method.success",
                extra={
                    "service": service_name,
                    "method": method_name,
                    "duration_ms": duration_ms,
                    "response_type": type(result).__name__,
                },
            )

            return result

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000

            metrics.timing("billing.service.method.duration", duration_ms, tags=metric_tags)
            metrics.incr(
                "billing.service.method.error",
                tags={**metric_tags, "error_type": type(e).__name__},
            )

            logger.exception(
                "billing.service.method.error",
                extra={
                    "service": service_name,
                    "method": method_name,
                    "duration_ms": duration_ms,
                    "error": str(e),
                    "error_type": type(e).__name__,
                },
            )
            raise

    return wrapper
