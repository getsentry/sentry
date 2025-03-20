from typing import Any, cast

from sentry.spans.consumers.process_segments.types import Span

# Keys in `sentry_tags` that are shared across all spans in a segment. This list
# is taken from `extract_shared_tags` in Relay.
SHARED_TAG_KEYS = (
    "release",
    "user",
    "user.id",
    "user.ip",
    "user.username",
    "user.email",
    "user.geo.country_code",
    "user.geo.subregion",
    "environment",
    "transaction",
    "transaction.method",
    "transaction.op",
    "trace.status",
    "mobile",
    "os.name",
    "device.class",
    "browser.name",
    "profiler_id",
    "sdk.name",
    "sdk.version",
    "platform",
    "thread.id",
    "thread.name",
)

# The name of the main thread used to infer the `main_thread` flag in spans from
# mobile applications.
MOBILE_MAIN_THREAD_NAME = "main"

# The default span.op to assume if it is missing on the span. This should be
# normalized by Relay, but we defensively apply the same fallback as the op is
# not guaranteed in typing.
DEFAULT_SPAN_OP = "default"


def match_schemas(spans) -> None:
    """
    Creates attributes for EAP spans that are required by logic shared with the
    event pipeline.

    Spans in the transaction event protocol had a slightly different schema
    compared to raw spans on the EAP topic. This function adds the missing
    attributes to the spans to make them compatible with the event pipeline
    logic.
    """

    for span in spans:
        sentry_tags = span.setdefault("sentry_tags", {})
        span["op"] = sentry_tags.get("op") or DEFAULT_SPAN_OP


def set_shared_tags(segment: Span, spans: list[Span]) -> None:
    """
    Extracts tags from the segment span and materializes them into all spans.
    """

    # Assume that Relay has extracted the shared tags into `sentry_tags` on the
    # root span. Once `sentry_tags` is removed, the logic from
    # `extract_shared_tags` should be moved here.
    segment_tags = segment.get("sentry_tags", {})
    shared_tags = {k: v for k, v in segment_tags.items() if k in SHARED_TAG_KEYS}

    is_mobile = segment_tags.get("mobile") == "true"
    mobile_start_type = _get_mobile_start_type(segment)
    ttid_ts = _timestamp_by_op(spans, "ui.load.initial_display")
    ttfd_ts = _timestamp_by_op(spans, "ui.load.full_display")

    for span in spans:
        span_tags = cast(dict[str, Any], span["sentry_tags"])

        if is_mobile:
            # NOTE: Like in Relay's implementation, shared tags are added at the
            # very end. This does not have access to the shared tag value. We
            # keep behavior consistent, although this should be revisited.
            if span_tags.get("thread.name") == MOBILE_MAIN_THREAD_NAME:
                span_tags["main_thread"] = "true"
            if not span_tags.get("app_start_type") and mobile_start_type:
                span_tags["app_start_type"] = mobile_start_type

        if ttid_ts is not None and span["end_timestamp_precise"] <= ttid_ts:
            span_tags["ttid"] = "ttid"
        if ttfd_ts is not None and span["end_timestamp_precise"] <= ttfd_ts:
            span_tags["ttfd"] = "ttfd"

        for key, value in shared_tags.items():
            if span_tags.get(key) is None:
                span_tags[key] = value


def _get_mobile_start_type(segment: Span) -> str | None:
    """
    Check the measurements on the span to determine what kind of start type the
    event is.
    """
    measurements = segment.get("measurements") or {}

    if "app_start_cold" in measurements:
        return "cold"
    if "app_start_warm" in measurements:
        return "warm"

    return None


def _timestamp_by_op(spans: list[Span], op: str) -> float | None:
    for span in spans:
        if span["op"] == op:
            return span["end_timestamp_precise"]
    return None


def set_exclusive_time(spans: list[Span]) -> None:
    """
    Sets the exclusive time on all spans in the list.

    The exclusive time is the time spent in a span's own code. This is the sum
    of all time intervals where no child span was active.
    """

    span_map: dict[str, list[tuple[int, int]]] = {}
    for span in spans:
        if parent_span_id := span.get("parent_span_id"):
            interval = (_us(span["start_timestamp_precise"]), _us(span["end_timestamp_precise"]))
            span_map.setdefault(parent_span_id, []).append(interval)

    for span in spans:
        intervals = span_map.get(span["span_id"], [])
        # Sort by start ASC, end DESC to skip over nested intervals efficiently
        intervals.sort(key=lambda x: (x[0], -x[1]))

        exclusive_time_us: int = 0  # microseconds to prevent rounding issues
        start, end = _us(span["start_timestamp_precise"]), _us(span["end_timestamp_precise"])

        # Progressively add time gaps before the next span and then skip to its end.
        for child_start, child_end in intervals:
            if child_start >= end:
                break
            if child_start > start:
                exclusive_time_us += child_start - start
            start = max(start, child_end)

        # Add any remaining time not covered by children
        exclusive_time_us += max(end - start, 0)

        # Note: Event protocol spans expect `exclusive_time` while EAP expects
        # `exclusive_time_ms`. Both are the same value in milliseconds
        span["exclusive_time"] = exclusive_time_us / 1_000
        span["exclusive_time_ms"] = exclusive_time_us / 1_000


def _us(timestamp: float) -> int:
    """Convert the floating point duration or timestamp to integer microsecond
    precision."""
    return int(timestamp * 1_000_000)
