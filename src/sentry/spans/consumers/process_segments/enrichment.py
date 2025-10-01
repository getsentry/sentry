from collections import defaultdict
from collections.abc import Sequence
from typing import Any

from sentry_kafka_schemas.schema_types.buffered_segments_v1 import SegmentSpan

from sentry.issue_detection.types import SentryTags as PerformanceIssuesSentryTags
from sentry.spans.consumers.process_segments.types import EnrichedSpan, get_span_op

# Keys of shared sentry attributes that are shared across all spans in a segment. This list
# is taken from `extract_shared_tags` in Relay.
SHARED_SENTRY_ATTRIBUTES = (
    "sentry.release",
    "sentry.user",
    "sentry.user.id",
    "sentry.user.ip",
    "sentry.user.username",
    "sentry.user.email",
    "sentry.user.geo.country_code",
    "sentry.user.geo.subregion",
    "sentry.environment",
    "sentry.transaction",
    "sentry.transaction.method",
    "sentry.transaction.op",
    "sentry.trace.status",
    "sentry.mobile",
    "sentry.os.name",
    "sentry.device.class",
    "sentry.browser.name",
    "sentry.profiler_id",
    "sentry.sdk.name",
    "sentry.sdk.version",
    "sentry.platform",
    "sentry.thread.id",
    "sentry.thread.name",
)

# The name of the main thread used to infer the `main_thread` flag in spans from
# mobile applications.
MOBILE_MAIN_THREAD_NAME = "main"

# The default span.op to assume if it is missing on the span. This should be
# normalized by Relay, but we defensively apply the same fallback as the op is
# not guaranteed in typing.
DEFAULT_SPAN_OP = "default"


def _find_segment_span(spans: list[SegmentSpan]) -> SegmentSpan | None:
    """
    Finds the segment in the span in the list that has ``is_segment`` set to
    ``True``.

    At most one span in the list can be marked as segment span. If more than one
    span is marked, the function does not have defined behavior.

    If there is no segment span, the function returns ``None``.
    """

    # Iterate backwards since we usually expect the segment span to be at the end.
    for span in reversed(spans):
        if span.get("is_segment"):
            return span

    return None


class TreeEnricher:
    """Enriches spans with information from their parent, child and sibling spans."""

    def __init__(self, spans: list[SegmentSpan]) -> None:
        self._segment_span = _find_segment_span(spans)

        self._ttid_ts = _timestamp_by_op(spans, "ui.load.initial_display")
        self._ttfd_ts = _timestamp_by_op(spans, "ui.load.full_display")

        self._span_map: dict[str, list[tuple[int, int]]] = {}
        for span in spans:
            if parent_span_id := span.get("parent_span_id"):
                interval = _span_interval(span)
                self._span_map.setdefault(parent_span_id, []).append(interval)

    def _data(self, span: SegmentSpan) -> dict[str, Any]:
        ret = {**span.get("data", {})}
        if self._segment_span is not None:
            # Assume that Relay has extracted the shared tags into `data` on the
            # root span. Once `sentry_tags` is removed, the logic from
            # `extract_shared_tags` should be moved here.
            segment_fields = self._segment_span.get("data", {})
            shared_tags = {k: v for k, v in segment_fields.items() if k in SHARED_SENTRY_ATTRIBUTES}

            is_mobile = segment_fields.get("sentry.mobile") == "true"
            mobile_start_type = _get_mobile_start_type(self._segment_span)

            if is_mobile:
                # NOTE: Like in Relay's implementation, shared tags are added at the
                # very end. This does not have access to the shared tag value. We
                # keep behavior consistent, although this should be revisited.
                if ret.get("sentry.thread.name") == MOBILE_MAIN_THREAD_NAME:
                    ret["sentry.main_thread"] = "true"
                if not ret.get("sentry.app_start_type") and mobile_start_type:
                    ret["sentry.app_start_type"] = mobile_start_type

            if self._ttid_ts is not None and span["end_timestamp_precise"] <= self._ttid_ts:
                ret["sentry.ttid"] = "ttid"
            if self._ttfd_ts is not None and span["end_timestamp_precise"] <= self._ttfd_ts:
                ret["sentry.ttfd"] = "ttfd"

            for key, value in shared_tags.items():
                if ret.get(key) is None:
                    ret[key] = value

        return ret

    def _sentry_tags(self, data: dict[str, Any]) -> dict[str, str]:
        """Backfill sentry tags used in performance issue detection.

        Once performance issue detection is only called from process_segments,
        (not from event_manager), the performance issues code can be refactored to access
        span attributes instead of sentry_tags.
        """
        sentry_tags = {}
        for tag_key in PerformanceIssuesSentryTags.__mutable_keys__:
            data_key = (
                "sentry.normalized_description" if tag_key == "description" else f"sentry.{tag_key}"
            )
            if data_key in data:
                sentry_tags[tag_key] = data[data_key]
        return sentry_tags

    def _exclusive_time(self, span: SegmentSpan) -> float:
        """
        Sets the exclusive time on all spans in the list.

        The exclusive time is the time spent in a span's own code. This is the sum
        of all time intervals where no child span was active.
        """

        intervals = self._span_map.get(span["span_id"], [])
        # Sort by start ASC, end DESC to skip over nested intervals efficiently
        intervals.sort(key=lambda x: (x[0], -x[1]))

        exclusive_time_us: int = 0  # microseconds to prevent rounding issues
        start, end = _span_interval(span)

        # Progressively add time gaps before the next span and then skip to its end.
        for child_start, child_end in intervals:
            if child_start >= end:
                break
            if child_start > start:
                exclusive_time_us += child_start - start
            start = max(start, child_end)

        # Add any remaining time not covered by children
        exclusive_time_us += max(end - start, 0)

        return exclusive_time_us / 1_000

    def enrich_span(self, span: SegmentSpan) -> EnrichedSpan:
        exclusive_time = self._exclusive_time(span)
        data = self._data(span)
        return {
            **span,
            "data": data,
            "exclusive_time_ms": exclusive_time,
        }

    @classmethod
    def enrich_spans(cls, spans: list[SegmentSpan]) -> tuple[int | None, list[EnrichedSpan]]:
        inst = cls(spans)
        ret = []
        segment_idx = None

        for i, span in enumerate(spans):
            enriched = inst.enrich_span(span)
            if span is inst._segment_span:
                segment_idx = i
            ret.append(enriched)

        return segment_idx, ret


def _get_mobile_start_type(segment: SegmentSpan) -> str | None:
    """
    Check the measurements on the span to determine what kind of start type the
    event is.
    """
    data = segment.get("data") or {}

    if "app_start_cold" in data:
        return "cold"
    if "app_start_warm" in data:
        return "warm"

    return None


def _timestamp_by_op(spans: list[SegmentSpan], op: str) -> float | None:
    for span in spans:
        if get_span_op(span) == op:
            return span["end_timestamp_precise"]
    return None


def _span_interval(span: SegmentSpan | EnrichedSpan) -> tuple[int, int]:
    """Get the start and end timestamps of a span in microseconds."""
    return _us(span["start_timestamp_precise"]), _us(span["end_timestamp_precise"])


def _us(timestamp: float) -> int:
    """Convert the floating point duration or timestamp to integer microsecond
    precision."""
    return int(timestamp * 1_000_000)


def compute_breakdowns(
    spans: Sequence[SegmentSpan],
    breakdowns_config: dict[str, dict[str, Any]],
) -> dict[str, float]:
    """
    Computes breakdowns from all spans and writes them to the segment span.

    Breakdowns are measurements that are derived from the spans in the segment.
    By convention, their unit is in milliseconds. In the end, these measurements
    are converted into attributes on the span trace item.
    """

    ret = {}
    for breakdown_name, breakdown_config in breakdowns_config.items():
        ty = breakdown_config.get("type")

        if ty == "spanOperations":
            breakdowns = _compute_span_ops(spans, breakdown_config)
        else:
            continue

        for key, value in breakdowns.items():
            ret[f"{breakdown_name}.{key}"] = value

    return ret


def _compute_span_ops(spans: Sequence[SegmentSpan], config: Any) -> dict[str, float]:
    matches = config.get("matches")
    if not matches:
        return {}

    intervals_by_op = defaultdict(list)
    for span in spans:
        op = get_span_op(span)
        if operation_name := next(filter(lambda m: op.startswith(m), matches), None):
            intervals_by_op[operation_name].append(_span_interval(span))

    ret: dict[str, float] = {}
    for operation_name, intervals in intervals_by_op.items():
        duration = _get_duration_us(intervals)
        ret[f"ops.{operation_name}"] = duration / 1000  # unit: millisecond
    return ret


def _get_duration_us(intervals: list[tuple[int, int]]) -> int:
    """
    Get the wall clock time duration covered by the intervals in microseconds.

    Overlapping intervals are merged so that they are not counted twice. For
    example, the intervals [(1, 3), (2, 4)] would yield a duration of 3, not 4.
    """

    duration = 0
    last_end = 0

    intervals.sort(key=lambda x: (x[0], -x[1]))
    for start, end in intervals:
        # Ensure the current interval doesn't overlap with the last one
        start = max(start, last_end)
        duration += max(end - start, 0)
        last_end = end

    return duration
