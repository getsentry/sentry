from __future__ import annotations

import contextlib
import contextvars
import functools
import hashlib
import logging
import time
from collections.abc import Callable, Generator
from typing import Any, TypeVar, overload

from google.protobuf.json_format import MessageToDict
from google.protobuf.message import Message

from sentry.utils import metrics
from sentry.utils.sdk import get_trace_id
from sentry.utils.tracing import set_span_data, start_span

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


_effective_sample_rate: contextvars.ContextVar[float] = contextvars.ContextVar(
    "_effective_sample_rate"
)


@contextlib.contextmanager
def _propagate_sample_rate(rate: float) -> Generator[None]:
    """Set the effective sample rate for this scope and restore it on exit.

    The effective rate is ``max(rate, parent_rate)`` so that if a parent
    service method is being logged, all children in the same call tree
    will be logged too.  The previous value is restored when the context
    manager exits, preventing siblings from inheriting each other's rates.
    """
    effective = max(rate, _effective_sample_rate.get(0.0))
    token = _effective_sample_rate.set(effective)
    try:
        yield
    finally:
        _effective_sample_rate.reset(token)


def _get_trace_hash() -> int | None:
    """Return a deterministic hash value for the current trace ID, or None if unavailable."""
    trace_id = get_trace_id()
    if trace_id is None:
        return None
    return int(hashlib.md5(str(trace_id).encode()).hexdigest(), 16) % 10000


def _should_log_trace() -> bool:
    """
    Determine whether to log based on a hash of the current trace ID and the
    effective sample rate from the ContextVar.

    The effective rate is set by ``_propagate_sample_rate`` as
    ``max(own_rate, parent_rate)``, so if a parent decided to log, all children
    in the same call tree will too.
    """
    effective_rate = _effective_sample_rate.get(0.0)
    trace_hash = _get_trace_hash()
    if trace_hash is None:
        return False
    return trace_hash < int(effective_rate * 10000)


@overload
def service_method(func: Callable[[Any, T], R]) -> Callable[[Any, T], R]: ...


@overload
def service_method(
    *, trace_log_sample_rate: float = ...
) -> Callable[[Callable[[Any, T], R]], Callable[[Any, T], R]]: ...


def service_method(
    func: Callable[[Any, T], R] | None = None,
    *,
    trace_log_sample_rate: float = 0.001,
) -> Callable[[Any, T], R] | Callable[[Callable[[Any, T], R]], Callable[[Any, T], R]]:
    """
    Decorator for billing service methods.

    Provides base functionality for service endpoints including:
    - Metrics collection
    - Observability/logging
    - Error handling
    - Request/response validation

    The decorated method should accept a protobuf request and return a protobuf response.

    Args:
        trace_log_sample_rate: Rate at which to log successful calls, based on
            a hash of the trace ID. Defaults to 0.001 (0.1%). Error logs are
            always emitted. The behavior is such that in a call tree of service methods,
            the effective sample rate for any node is max(self.trace_log_sample_rate, parent.trace_log_sample_rate)

            Example:
                Service.method_1(trace_log_sample_rate=0.1) # effective rate = 0.1
                    -> Service.method_2(trace_log_sample_rate=0.5) # effective_rate = 0.5
                        -> Service.method_3(trace_log_sample_rate=0.001) # effective_rate = 0.5 (because parent is higher)
                    -> Service.method_4(trace_log_sample_rate=0.2) # effective_rate = 0.2
    Example:
        @service_method
        def get_contract(self, request: GetContractRequest) -> GetContractResponse:
            pass

        @service_method(trace_log_sample_rate=0.01)
        def high_volume_method(self, request: Request) -> Response:
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

            with _propagate_sample_rate(trace_log_sample_rate):
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
                    with start_span(
                        op="function", name=f"{service_name}.{method_name}"
                    ) as cur_span:
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
                    metrics.incr(
                        "billing.service.method.success", tags=metric_tags, sample_rate=1.0
                    )

                    if _should_log_trace():
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
                    metrics.incr(
                        "billing.service.method.error",
                        tags={**metric_tags, "error_type": type(e).__name__},
                        sample_rate=1.0,
                    )

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
