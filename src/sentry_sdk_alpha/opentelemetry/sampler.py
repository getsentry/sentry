from decimal import Decimal
from typing import cast

from opentelemetry import trace
from opentelemetry.sdk.trace.sampling import Sampler, SamplingResult, Decision
from opentelemetry.trace.span import TraceState

import sentry_sdk_alpha
from sentry_sdk_alpha.opentelemetry.consts import (
    TRACESTATE_SAMPLED_KEY,
    TRACESTATE_SAMPLE_RAND_KEY,
    TRACESTATE_SAMPLE_RATE_KEY,
    SentrySpanAttribute,
)
from sentry_sdk_alpha.tracing_utils import (
    _generate_sample_rand,
    has_tracing_enabled,
)
from sentry_sdk_alpha.utils import is_valid_sample_rate, logger

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from typing import Any, Optional, Sequence, Union
    from opentelemetry.context import Context
    from opentelemetry.trace import Link, SpanKind
    from opentelemetry.trace.span import SpanContext
    from opentelemetry.util.types import Attributes


def get_parent_sampled(parent_context, trace_id):
    # type: (Optional[SpanContext], int) -> Optional[bool]
    if parent_context is None:
        return None

    is_span_context_valid = parent_context is not None and parent_context.is_valid

    # Only inherit sample rate if `traceId` is the same
    if is_span_context_valid and parent_context.trace_id == trace_id:
        # this is getSamplingDecision in JS
        # if there was no sampling flag, defer the decision
        dsc_sampled = parent_context.trace_state.get(TRACESTATE_SAMPLED_KEY)
        if dsc_sampled == "deferred":
            return None

        if parent_context.trace_flags.sampled is not None:
            return parent_context.trace_flags.sampled

        if dsc_sampled == "true":
            return True
        elif dsc_sampled == "false":
            return False

    return None


def get_parent_sample_rate(parent_context, trace_id):
    # type: (Optional[SpanContext], int) -> Optional[float]
    if parent_context is None:
        return None

    is_span_context_valid = parent_context is not None and parent_context.is_valid

    if is_span_context_valid and parent_context.trace_id == trace_id:
        parent_sample_rate = parent_context.trace_state.get(TRACESTATE_SAMPLE_RATE_KEY)
        if parent_sample_rate is None:
            return None

        try:
            return float(parent_sample_rate)
        except Exception:
            return None

    return None


def get_parent_sample_rand(parent_context, trace_id):
    # type: (Optional[SpanContext], int) -> Optional[Decimal]
    if parent_context is None:
        return None

    is_span_context_valid = parent_context is not None and parent_context.is_valid

    if is_span_context_valid and parent_context.trace_id == trace_id:
        parent_sample_rand = parent_context.trace_state.get(TRACESTATE_SAMPLE_RAND_KEY)
        if parent_sample_rand is None:
            return None

        return Decimal(parent_sample_rand)

    return None


def dropped_result(span_context, attributes, sample_rate=None, sample_rand=None):
    # type: (SpanContext, Attributes, Optional[float], Optional[Decimal]) -> SamplingResult
    """
    React to a span getting unsampled and return a DROP SamplingResult.

    Update the trace_state with the effective sampled, sample_rate and sample_rand,
    record that we dropped the event for client report purposes, and return
    an OTel SamplingResult with Decision.DROP.

    See for more info about OTel sampling:
    https://opentelemetry-python.readthedocs.io/en/latest/sdk/trace.sampling.html
    """
    trace_state = _update_trace_state(
        span_context, sampled=False, sample_rate=sample_rate, sample_rand=sample_rand
    )

    is_root_span = not (span_context.is_valid and not span_context.is_remote)
    if is_root_span:
        # Tell Sentry why we dropped the transaction/root-span
        client = sentry_sdk_alpha.get_client()
        if client.monitor and client.monitor.downsample_factor > 0:
            reason = "backpressure"
        else:
            reason = "sample_rate"

        if client.transport and has_tracing_enabled(client.options):
            client.transport.record_lost_event(reason, data_category="transaction")

            # Only one span (the transaction itself) is discarded, since we did not record any spans here.
            client.transport.record_lost_event(reason, data_category="span")

    return SamplingResult(
        Decision.DROP,
        attributes=attributes,
        trace_state=trace_state,
    )


def sampled_result(span_context, attributes, sample_rate=None, sample_rand=None):
    # type: (SpanContext, Attributes, Optional[float], Optional[Decimal]) -> SamplingResult
    """
    React to a span being sampled and return a sampled SamplingResult.

    Update the trace_state with the effective sampled, sample_rate and sample_rand,
    and return an OTel SamplingResult with Decision.RECORD_AND_SAMPLE.

    See for more info about OTel sampling:
    https://opentelemetry-python.readthedocs.io/en/latest/sdk/trace.sampling.html
    """
    trace_state = _update_trace_state(
        span_context, sampled=True, sample_rate=sample_rate, sample_rand=sample_rand
    )

    return SamplingResult(
        Decision.RECORD_AND_SAMPLE,
        attributes=attributes,
        trace_state=trace_state,
    )


def _update_trace_state(span_context, sampled, sample_rate=None, sample_rand=None):
    # type: (SpanContext, bool, Optional[float], Optional[Decimal]) -> TraceState
    trace_state = span_context.trace_state

    sampled = "true" if sampled else "false"
    if TRACESTATE_SAMPLED_KEY not in trace_state:
        trace_state = trace_state.add(TRACESTATE_SAMPLED_KEY, sampled)
    elif trace_state.get(TRACESTATE_SAMPLED_KEY) == "deferred":
        trace_state = trace_state.update(TRACESTATE_SAMPLED_KEY, sampled)

    if sample_rate is not None:
        trace_state = trace_state.update(TRACESTATE_SAMPLE_RATE_KEY, str(sample_rate))

    if sample_rand is not None:
        trace_state = trace_state.update(
            TRACESTATE_SAMPLE_RAND_KEY, f"{sample_rand:.6f}"  # noqa: E231
        )

    return trace_state


class SentrySampler(Sampler):
    def should_sample(
        self,
        parent_context,  # type: Optional[Context]
        trace_id,  # type: int
        name,  # type: str
        kind=None,  # type: Optional[SpanKind]
        attributes=None,  # type: Attributes
        links=None,  # type: Optional[Sequence[Link]]
        trace_state=None,  # type: Optional[TraceState]
    ):
        # type: (...) -> SamplingResult
        client = sentry_sdk_alpha.get_client()

        parent_span_context = trace.get_current_span(parent_context).get_span_context()

        attributes = attributes or {}

        # No tracing enabled, thus no sampling
        if not has_tracing_enabled(client.options):
            return dropped_result(parent_span_context, attributes)

        # parent_span_context.is_valid means this span has a parent, remote or local
        is_root_span = not parent_span_context.is_valid or parent_span_context.is_remote

        sample_rate = None

        parent_sampled = get_parent_sampled(parent_span_context, trace_id)
        parent_sample_rate = get_parent_sample_rate(parent_span_context, trace_id)
        parent_sample_rand = get_parent_sample_rand(parent_span_context, trace_id)

        if parent_sample_rand is not None:
            # We have a sample_rand on the incoming trace or we already backfilled
            # it in PropagationContext
            sample_rand = parent_sample_rand
        else:
            # We are the head SDK and we need to generate a new sample_rand
            sample_rand = cast(Decimal, _generate_sample_rand(str(trace_id), (0, 1)))

        # Explicit sampled value provided at start_span
        custom_sampled = cast(
            "Optional[bool]", attributes.get(SentrySpanAttribute.CUSTOM_SAMPLED)
        )
        if custom_sampled is not None:
            if is_root_span:
                sample_rate = float(custom_sampled)
                if sample_rate > 0:
                    return sampled_result(
                        parent_span_context,
                        attributes,
                        sample_rate=sample_rate,
                        sample_rand=sample_rand,
                    )
                else:
                    return dropped_result(
                        parent_span_context,
                        attributes,
                        sample_rate=sample_rate,
                        sample_rand=sample_rand,
                    )
            else:
                logger.debug(
                    f"[Tracing.Sampler] Ignoring sampled param for non-root span {name}"
                )

        # Check if there is a traces_sampler
        # Traces_sampler is responsible to check parent sampled to have full transactions.
        has_traces_sampler = callable(client.options.get("traces_sampler"))

        sample_rate_to_propagate = None

        if is_root_span and has_traces_sampler:
            sampling_context = create_sampling_context(
                name, attributes, parent_span_context, trace_id
            )
            sample_rate = client.options["traces_sampler"](sampling_context)
            sample_rate_to_propagate = sample_rate
        else:
            # Check if there is a parent with a sampling decision
            if parent_sampled is not None:
                sample_rate = bool(parent_sampled)
                sample_rate_to_propagate = (
                    parent_sample_rate if parent_sample_rate else sample_rate
                )
            else:
                # Check if there is a traces_sample_rate
                sample_rate = client.options.get("traces_sample_rate")
                sample_rate_to_propagate = sample_rate

        # If the sample rate is invalid, drop the span
        if not is_valid_sample_rate(sample_rate, source=self.__class__.__name__):
            logger.warning(
                f"[Tracing.Sampler] Discarding {name} because of invalid sample rate."
            )
            return dropped_result(parent_span_context, attributes)

        # Down-sample in case of back pressure monitor says so
        if is_root_span and client.monitor:
            sample_rate /= 2**client.monitor.downsample_factor
            if client.monitor.downsample_factor > 0:
                sample_rate_to_propagate = sample_rate

        # Compare sample_rand to sample_rate to make the final sampling decision
        sample_rate = float(cast("Union[bool, float, int]", sample_rate))
        sampled = sample_rand < Decimal.from_float(sample_rate)

        if sampled:
            if is_root_span:
                logger.debug(
                    f"[Tracing.Sampler] Sampled #{name} with sample_rate: {sample_rate} and sample_rand: {sample_rand}"
                )

            return sampled_result(
                parent_span_context,
                attributes,
                sample_rate=sample_rate_to_propagate,
                sample_rand=None if sample_rand == parent_sample_rand else sample_rand,
            )
        else:
            if is_root_span:
                logger.debug(
                    f"[Tracing.Sampler] Dropped #{name} with sample_rate: {sample_rate} and sample_rand: {sample_rand}"
                )

            return dropped_result(
                parent_span_context,
                attributes,
                sample_rate=sample_rate_to_propagate,
                sample_rand=None if sample_rand == parent_sample_rand else sample_rand,
            )

    def get_description(self) -> str:
        return self.__class__.__name__


def create_sampling_context(name, attributes, parent_span_context, trace_id):
    # type: (str, Attributes, Optional[SpanContext], int) -> dict[str, Any]
    sampling_context = {
        "transaction_context": {
            "name": name,
            "op": attributes.get(SentrySpanAttribute.OP) if attributes else None,
            "source": (
                attributes.get(SentrySpanAttribute.SOURCE) if attributes else None
            ),
        },
        "parent_sampled": get_parent_sampled(parent_span_context, trace_id),
    }  # type: dict[str, Any]

    if attributes is not None:
        sampling_context.update(attributes)

    return sampling_context
