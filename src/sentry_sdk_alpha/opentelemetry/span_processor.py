from collections import deque, defaultdict
from typing import cast

from opentelemetry.trace import (
    format_trace_id,
    format_span_id,
    get_current_span,
    INVALID_SPAN,
    Span as AbstractSpan,
)
from opentelemetry.context import Context
from opentelemetry.sdk.trace import Span, ReadableSpan, SpanProcessor

import sentry_sdk_alpha
from sentry_sdk_alpha.consts import SPANDATA, DEFAULT_SPAN_ORIGIN
from sentry_sdk_alpha.utils import get_current_thread_meta
from sentry_sdk_alpha.opentelemetry.consts import (
    OTEL_SENTRY_CONTEXT,
    SentrySpanAttribute,
)
from sentry_sdk_alpha.opentelemetry.sampler import create_sampling_context
from sentry_sdk_alpha.opentelemetry.utils import (
    is_sentry_span,
    convert_from_otel_timestamp,
    extract_span_attributes,
    extract_span_data,
    extract_transaction_name_source,
    get_trace_context,
    get_profile_context,
    get_sentry_meta,
    set_sentry_meta,
)
from sentry_sdk_alpha.profiler.continuous_profiler import (
    try_autostart_continuous_profiler,
    get_profiler_id,
    try_profile_lifecycle_trace_start,
)
from sentry_sdk_alpha.profiler.transaction_profiler import Profile
from sentry_sdk_alpha._types import TYPE_CHECKING

if TYPE_CHECKING:
    from typing import Optional, List, Any, Deque, DefaultDict
    from sentry_sdk_alpha._types import Event


DEFAULT_MAX_SPANS = 1000


class SentrySpanProcessor(SpanProcessor):
    """
    Converts OTel spans into Sentry spans so they can be sent to the Sentry backend.
    """

    def __new__(cls):
        # type: () -> SentrySpanProcessor
        if not hasattr(cls, "instance"):
            cls.instance = super().__new__(cls)

        return cls.instance

    def __init__(self):
        # type: () -> None
        self._children_spans = defaultdict(
            list
        )  # type: DefaultDict[int, List[ReadableSpan]]
        self._dropped_spans = defaultdict(lambda: 0)  # type: DefaultDict[int, int]

    def on_start(self, span, parent_context=None):
        # type: (Span, Optional[Context]) -> None
        if is_sentry_span(span):
            return

        self._add_root_span(span, get_current_span(parent_context))
        self._start_profile(span)

    def on_end(self, span):
        # type: (ReadableSpan) -> None
        if is_sentry_span(span):
            return

        is_root_span = not span.parent or span.parent.is_remote
        if is_root_span:
            # if have a root span ending, stop the profiler, build a transaction and send it
            self._stop_profile(span)
            self._flush_root_span(span)
        else:
            self._append_child_span(span)

    # TODO-neel-potel not sure we need a clear like JS
    def shutdown(self):
        # type: () -> None
        pass

    # TODO-neel-potel change default? this is 30 sec
    # TODO-neel-potel call this in client.flush
    def force_flush(self, timeout_millis=30000):
        # type: (int) -> bool
        return True

    def _add_root_span(self, span, parent_span):
        # type: (Span, AbstractSpan) -> None
        """
        This is required to make Span.root_span work
        since we can't traverse back to the root purely with otel efficiently.
        """
        if parent_span != INVALID_SPAN and not parent_span.get_span_context().is_remote:
            # child span points to parent's root or parent
            parent_root_span = get_sentry_meta(parent_span, "root_span")
            set_sentry_meta(span, "root_span", parent_root_span or parent_span)
        else:
            # root span points to itself
            set_sentry_meta(span, "root_span", span)

    def _start_profile(self, span):
        # type: (Span) -> None
        try_autostart_continuous_profiler()

        profiler_id = get_profiler_id()
        thread_id, thread_name = get_current_thread_meta()

        if profiler_id:
            span.set_attribute(SPANDATA.PROFILER_ID, profiler_id)
        if thread_id:
            span.set_attribute(SPANDATA.THREAD_ID, str(thread_id))
        if thread_name:
            span.set_attribute(SPANDATA.THREAD_NAME, thread_name)

        is_root_span = not span.parent or span.parent.is_remote
        sampled = span.context and span.context.trace_flags.sampled

        if is_root_span and sampled:
            # profiler uses time.perf_counter_ns() so we cannot use the
            # unix timestamp that is on span.start_time
            # setting it to 0 means the profiler will internally measure time on start
            profile = Profile(sampled, 0)

            sampling_context = create_sampling_context(
                span.name, span.attributes, span.parent, span.context.trace_id
            )
            profile._set_initial_sampling_decision(sampling_context)
            profile.__enter__()
            set_sentry_meta(span, "profile", profile)

            continuous_profile = try_profile_lifecycle_trace_start()
            profiler_id = get_profiler_id()
            if profiler_id:
                span.set_attribute(SPANDATA.PROFILER_ID, profiler_id)
            set_sentry_meta(span, "continuous_profile", continuous_profile)

    def _stop_profile(self, span):
        # type: (ReadableSpan) -> None
        continuous_profiler = get_sentry_meta(span, "continuous_profile")
        if continuous_profiler:
            continuous_profiler.stop()

    def _flush_root_span(self, span):
        # type: (ReadableSpan) -> None
        transaction_event = self._root_span_to_transaction_event(span)
        if not transaction_event:
            return

        collected_spans, dropped_spans = self._collect_children(span)
        spans = []
        for child in collected_spans:
            span_json = self._span_to_json(child)
            if span_json:
                spans.append(span_json)

        transaction_event["spans"] = spans
        if dropped_spans > 0:
            transaction_event["_dropped_spans"] = dropped_spans

        # TODO-neel-potel sort and cutoff max spans

        sentry_sdk_alpha.capture_event(transaction_event)

    def _append_child_span(self, span):
        # type: (ReadableSpan) -> None
        if not span.parent:
            return

        max_spans = (
            sentry_sdk_alpha.get_client().options["_experiments"].get("max_spans")
            or DEFAULT_MAX_SPANS
        )

        children_spans = self._children_spans[span.parent.span_id]
        if len(children_spans) < max_spans:
            children_spans.append(span)
        else:
            self._dropped_spans[span.parent.span_id] += 1

    def _collect_children(self, span):
        # type: (ReadableSpan) -> tuple[List[ReadableSpan], int]
        if not span.context:
            return [], 0

        children = []
        dropped_spans = 0
        bfs_queue = deque()  # type: Deque[int]
        bfs_queue.append(span.context.span_id)

        while bfs_queue:
            parent_span_id = bfs_queue.popleft()
            node_children = self._children_spans.pop(parent_span_id, [])
            dropped_spans += self._dropped_spans.pop(parent_span_id, 0)
            children.extend(node_children)
            bfs_queue.extend(
                [child.context.span_id for child in node_children if child.context]
            )

        return children, dropped_spans

    # we construct the event from scratch here
    # and not use the current Transaction class for easier refactoring
    def _root_span_to_transaction_event(self, span):
        # type: (ReadableSpan) -> Optional[Event]
        if not span.context:
            return None

        event = self._common_span_transaction_attributes_as_json(span)
        if event is None:
            return None

        transaction_name, transaction_source = extract_transaction_name_source(span)
        span_data = extract_span_data(span)
        trace_context = get_trace_context(span, span_data=span_data)
        contexts = {"trace": trace_context}

        profile_context = get_profile_context(span)
        if profile_context:
            contexts["profile"] = profile_context

        (_, description, _, http_status, _) = span_data

        if http_status:
            contexts["response"] = {"status_code": http_status}

        if span.resource.attributes:
            contexts[OTEL_SENTRY_CONTEXT] = {"resource": dict(span.resource.attributes)}

        event.update(
            {
                "type": "transaction",
                "transaction": transaction_name or description,
                "transaction_info": {"source": transaction_source or "custom"},
                "contexts": contexts,
            }
        )

        profile = cast("Optional[Profile]", get_sentry_meta(span, "profile"))
        if profile:
            profile.__exit__(None, None, None)
            if profile.valid():
                event["profile"] = profile
                set_sentry_meta(span, "profile", None)

        return event

    def _span_to_json(self, span):
        # type: (ReadableSpan) -> Optional[dict[str, Any]]
        if not span.context:
            return None

        # This is a safe cast because dict[str, Any] is a superset of Event
        span_json = cast(
            "dict[str, Any]", self._common_span_transaction_attributes_as_json(span)
        )
        if span_json is None:
            return None

        trace_id = format_trace_id(span.context.trace_id)
        span_id = format_span_id(span.context.span_id)
        parent_span_id = format_span_id(span.parent.span_id) if span.parent else None

        (op, description, status, _, origin) = extract_span_data(span)

        span_json.update(
            {
                "trace_id": trace_id,
                "span_id": span_id,
                "op": op,
                "description": description,
                "status": status,
                "origin": origin or DEFAULT_SPAN_ORIGIN,
            }
        )

        if parent_span_id:
            span_json["parent_span_id"] = parent_span_id

        attributes = getattr(span, "attributes", {}) or {}
        if attributes:
            span_json["data"] = {}
            for key, value in attributes.items():
                if not key.startswith("_"):
                    span_json["data"][key] = value

        return span_json

    def _common_span_transaction_attributes_as_json(self, span):
        # type: (ReadableSpan) -> Optional[Event]
        if not span.start_time or not span.end_time:
            return None

        common_json = {
            "start_timestamp": convert_from_otel_timestamp(span.start_time),
            "timestamp": convert_from_otel_timestamp(span.end_time),
        }  # type: Event

        tags = extract_span_attributes(span, SentrySpanAttribute.TAG)
        if tags:
            common_json["tags"] = tags

        return common_json

    def _log_debug_info(self):
        # type: () -> None
        import pprint

        pprint.pprint(
            {
                format_span_id(span_id): [
                    (format_span_id(child.context.span_id), child.name)
                    for child in children
                ]
                for span_id, children in self._children_spans.items()
            }
        )
