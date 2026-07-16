from __future__ import annotations

import functools
import logging
import time
from collections.abc import Callable
from random import random
from typing import Any, TypeVar, overload

from google.protobuf.json_format import MessageToDict
from google.protobuf.message import Message

from sentry.utils import metrics
from sentry.utils.tracing import set_span_data, start_span

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=Message)
R = TypeVar("R", bound=Message)

# Sample success structured logs by default; dial to 1.0 when debugging a new method.
DEFAULT_TRACE_LOG_SAMPLE_RATE = 0.001


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


@overload
def service_method(func: Callable[[Any, T], R]) -> Callable[[Any, T], R]: ...


@overload
def service_method(
    *,
    trace_log_sample_rate: float = DEFAULT_TRACE_LOG_SAMPLE_RATE,
) -> Callable[[Callable[[Any, T], R]], Callable[[Any, T], R]]: ...


def service_method(
    func: Callable[[Any, T], R] | None = None,
    *,
    trace_log_sample_rate: float = DEFAULT_TRACE_LOG_SAMPLE_RATE,
) -> Callable[[Any, T], R] | Callable[[Callable[[Any, T], R]], Callable[[Any, T], R]]:
    """
    Decorator for billing service methods.

    Provides base functionality for service endpoints including:
    - Metrics collection
    - Observability/logging
    - Error handling
    - Request/response validation

    Success structured logs are sampled via ``trace_log_sample_rate`` (default
    0.1%). Pass ``trace_log_sample_rate=1.0`` when validating a new method.
    Error logs are always emitted. Datadog metrics are always emitted.

    The decorated method should accept a protobuf request and return a protobuf response.

    Example:
        @service_method
        def get_contract(self, request: GetContractRequest) -> GetContractResponse:
            pass

        @service_method(trace_log_sample_rate=1.0)
        def experimental_method(self, request: ...) -> ...:
            pass
    """

    def decorator(func: Callable[[Any, T], R]) -> Callable[[Any, T], R]:
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

            metrics.incr("billing.service.method.called", tags=metric_tags, sample_rate=1.0)
            extras = {
                "service": service_name,
                "method": method_name,
                "request_type": type(request).__name__,
                "request": MessageToDict(request),
            }
            if organization_id := getattr(request, "organization_id", None):
                extras["organization_id"] = organization_id
            if contract_id := getattr(request, "contract_id", None):
                extras["contract_id"] = contract_id

            try:
                with start_span(op="function", name=f"{service_name}.{method_name}") as cur_span:
                    for k, v in extras.items():
                        set_span_data(cur_span, k, v)
                    result = func(self, request)

                # Validate output is a protobuf message
                if not isinstance(result, Message):
                    raise TypeError(
                        f"{service_name}.{method_name} must return a protobuf Message, "
                        f"returned {type(result).__name__}"
                    )

                duration_ms = (time.time() - start_time) * 1000

                metrics.timing(
                    "billing.service.method.duration",
                    duration_ms,
                    tags=metric_tags,
                    sample_rate=1.0,
                )
                metrics.incr("billing.service.method.success", tags=metric_tags, sample_rate=1.0)

                if _should_emit_trace_log(trace_log_sample_rate):
                    logger.info(
                        "billing.service.method.success",
                        extra={
                            "duration_ms": duration_ms,
                            "response_type": type(result).__name__,
                            "response": MessageToDict(result),
                            **extras,
                        },
                    )

                return result

            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000

                metrics.timing(
                    "billing.service.method.duration",
                    duration_ms,
                    tags=metric_tags,
                    sample_rate=1.0,
                )
                tags = {**metric_tags, "error_type": type(e).__name__}
                metrics.incr("billing.service.method.error", tags=tags, sample_rate=1.0)

                logger.info(
                    "billing.service.method.error",
                    extra={
                        "duration_ms": duration_ms,
                        "error": str(e),
                        "error_type": type(e).__name__,
                        **extras,
                    },
                )
                raise

        return wrapper

    if func is not None:
        return decorator(func)
    return decorator


def _should_emit_trace_log(sample_rate: float) -> bool:
    return sample_rate >= 1.0 or (sample_rate > 0.0 and random() < sample_rate)
