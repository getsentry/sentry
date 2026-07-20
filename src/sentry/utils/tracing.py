import functools
import inspect
from typing import TYPE_CHECKING, Any, Callable, ParamSpec, TypeVar, overload

import sentry_sdk
from sentry_sdk.scope import Scope
from sentry_sdk.traces import StreamedSpan, new_trace
from sentry_sdk.tracing import NoOpSpan, Span, Transaction
from sentry_sdk.tracing_utils import has_span_streaming_enabled

if TYPE_CHECKING:
    from sentry_sdk.tracing import TransactionKwargs


P = ParamSpec("P")
R = TypeVar("R")


@overload
def trace(
    func: Callable[P, R],
    *,
    op: str | None = None,
    name: str | None = None,
) -> Callable[P, R]: ...


@overload
def trace(
    func: None = None,
    *,
    op: str | None = None,
    name: str | None = None,
) -> Callable[[Callable[P, R]], Callable[P, R]]: ...


def trace(
    func: Callable[..., Any] | None = None, *, op: str | None = None, name: str | None = None
) -> Any:
    def decorator(f: Callable[..., Any]) -> Callable[..., Any]:
        streaming_wrapped = sentry_sdk.traces.trace(
            name=name,
            attributes=None if op is None else {"sentry.op": op},
        )(f)
        non_streaming_wrapped = sentry_sdk.trace(
            op=op,
            name=name,
        )(f)

        if inspect.iscoroutinefunction(f):

            @functools.wraps(f)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                if has_span_streaming_enabled(sentry_sdk.get_client().options):
                    return await streaming_wrapped(*args, **kwargs)
                return await non_streaming_wrapped(*args, **kwargs)

            return async_wrapper

        @functools.wraps(f)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            if has_span_streaming_enabled(sentry_sdk.get_client().options):
                return streaming_wrapped(*args, **kwargs)
            return non_streaming_wrapped(*args, **kwargs)

        return wrapper

    if func:
        return decorator(func)

    return decorator


def start_span(
    *,
    name: str,
    op: str | None = None,
    source: str | None = None,
    custom_sampling_context: dict[str, Any] | None = None,
    transaction: bool = False,
) -> Transaction | NoOpSpan | StreamedSpan | Span:
    """
    Starts and returns a streamed span if the streaming trace lifecycle is enabled. Otherwise, starts and returns a transaction or child span.

    Accepts the minimum set of arguments currently used by this repo's `sentry_sdk.start_span()` and `sentry_sdk.start_transaction()` call sites.
    """
    span_streaming = has_span_streaming_enabled(sentry_sdk.get_client().options)
    if span_streaming:
        attributes = {}
        if op is not None:
            attributes["sentry.op"] = op

        if source is not None:
            attributes["sentry.span.source"] = source

        if transaction:
            """
            Prior to span streaming, calling start_transaction created a new trace.
            To keep this behaviour for manual instrumentation in sync, we always create a new trace here as well.
            """
            new_trace()
            previous_custom_sampling_context = None
            if custom_sampling_context is not None:
                scope = sentry_sdk.get_current_scope()
                propagation_context = scope.get_active_propagation_context()
                previous_custom_sampling_context = propagation_context.custom_sampling_context

                Scope.set_custom_sampling_context(custom_sampling_context)

            try:
                return sentry_sdk.traces.start_span(
                    name=name,
                    attributes=attributes,  # type: ignore[arg-type]
                    parent_span=None,
                )
            finally:
                if custom_sampling_context is not None:
                    scope = sentry_sdk.get_current_scope()
                    propagation_context = scope.get_active_propagation_context()
                    propagation_context.custom_sampling_context = previous_custom_sampling_context

        return sentry_sdk.traces.start_span(
            name=name,
            attributes=attributes,  # type: ignore[arg-type]
        )

    if transaction:
        kwargs: TransactionKwargs = {"name": name}
        if op is not None:
            kwargs["op"] = op

        if source is not None:
            kwargs["source"] = source

        return sentry_sdk.start_transaction(
            custom_sampling_context=custom_sampling_context,
            **kwargs,
        )

    return sentry_sdk.start_span(
        name=name,
        op=op,
    )


def get_current_span() -> StreamedSpan | Span | None:
    if has_span_streaming_enabled(sentry_sdk.get_client().options):
        return sentry_sdk.traces.get_current_span()

    return sentry_sdk.get_current_span()


def set_span_tag(span: Span | StreamedSpan, key: str, value: Any) -> None:
    """
    Sets an attribute on a span if the streaming trace lifecycle is enabled. Otherwise, sets a tag on the span.
    """
    if isinstance(span, StreamedSpan):
        span.set_attribute(key, value)
    else:
        span.set_tag(key, value)


def set_span_data(span: Span | StreamedSpan, key: str, value: Any) -> None:
    """
    Sets an attribute on a span if the streaming trace lifecycle is enabled. Otherwise, sets data on the span.
    """
    if isinstance(span, StreamedSpan):
        span.set_attribute(key, value)
    else:
        span.set_data(key, value)
