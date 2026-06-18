from typing import TYPE_CHECKING, Any

import sentry_sdk
from sentry_sdk.scope import Scope
from sentry_sdk.traces import NoOpStreamedSpan, StreamedSpan
from sentry_sdk.tracing import NoOpSpan, Span, Transaction
from sentry_sdk.tracing_utils import has_span_streaming_enabled

if TYPE_CHECKING:
    from sentry_sdk.tracing import TransactionKwargs


def start_span(
    *,
    name: str,
    op: str | None = None,
    source: str | None = None,
    sampled: bool | None = None,
    custom_sampling_context: dict[str, Any] | None = None,
    transaction: bool = False,
) -> Transaction | NoOpSpan | StreamedSpan | Span:
    """
    Starts and returns a streamed span if the streaming trace lifecycle is enabled. Otherwise, starts and returns a transaction or child span.

    Accepts the minimum set of arguments currently used by this repo's `sentry_sdk.start_span()` and `sentry_sdk.start_transaction()` call sites.
    """
    span_streaming = has_span_streaming_enabled(sentry_sdk.get_client().options)
    if span_streaming:
        previous_custom_sampling_context = None
        if custom_sampling_context is not None:
            scope = sentry_sdk.get_current_scope()
            propagation_context = scope.get_active_propagation_context()
            previous_custom_sampling_context = propagation_context.custom_sampling_context

            Scope.set_custom_sampling_context(custom_sampling_context)

        attributes = {}
        if op is not None:
            attributes["sentry.op"] = op

        if source is not None:
            attributes["sentry.span.source"] = source

        if sampled is not False and transaction:
            span = sentry_sdk.traces.start_span(
                name=name,
                attributes=attributes,  # type: ignore[arg-type]
                parent_span=None,
            )
        elif sampled is not False:
            span = sentry_sdk.traces.start_span(
                name=name,
                attributes=attributes,  # type: ignore[arg-type]
            )
        else:
            span = NoOpStreamedSpan(
                scope=sentry_sdk.get_current_scope(),
                unsampled_reason="sample_rate",
            )

        try:
            return span
        finally:
            if previous_custom_sampling_context is not None:
                Scope.set_custom_sampling_context(previous_custom_sampling_context)

    if transaction:
        kwargs: TransactionKwargs = {"name": name}
        if op is not None:
            kwargs["op"] = op

        if source is not None:
            kwargs["source"] = source

        if sampled is not None:
            kwargs["sampled"] = sampled

        return sentry_sdk.start_transaction(
            custom_sampling_context=custom_sampling_context,
            **kwargs,
        )

    return sentry_sdk.start_span(
        name=name,
        op=op,
    )


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
