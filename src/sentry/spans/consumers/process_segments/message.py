import logging
import uuid
from copy import deepcopy
from typing import Any, cast

from django.core.exceptions import ValidationError
from sentry_kafka_schemas.schema_types.buffered_segments_v1 import SegmentSpan as SchemaSpan

from sentry import options
from sentry.constants import INSIGHT_MODULE_FILTERS
from sentry.dynamic_sampling.rules.helpers.latest_releases import record_latest_release
from sentry.event_manager import get_project_insight_flag
from sentry.issues.grouptype import PerformanceStreamedSpansGroupTypeExperimental
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.models.environment import Environment
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.receivers.features import record_generic_event_processed
from sentry.receivers.onboarding import (
    record_first_insight_span,
    record_first_transaction,
    record_release_received,
)
from sentry.spans.grouping.api import load_span_grouping_config
from sentry.utils import metrics
from sentry.utils.dates import to_datetime
from sentry.utils.performance_issues.performance_detection import detect_performance_problems

logger = logging.getLogger(__name__)


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


class Span(SchemaSpan, total=False):
    start_timestamp_precise: float  # Missing in schema
    end_timestamp_precise: float  # Missing in schema
    op: str | None  # Added in enrichment
    hash: str | None  # Added in enrichment


@metrics.wraps("spans.consumers.process_segments.process_segment")
def process_segment(spans: list[Span]) -> list[Span]:
    segment_span = _find_segment_span(spans)
    _enrich_spans(segment_span, spans)

    if segment_span is None:
        return spans

    with metrics.timer("spans.consumers.process_segments.get_project"):
        project = Project.objects.get_from_cache(id=segment_span["project_id"])

    _create_models(segment_span, project)
    _detect_performance_problems(segment_span, spans, project)
    _record_signals(segment_span, spans, project)

    return spans


def _find_segment_span(spans: list[Span]) -> Span | None:
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


@metrics.wraps("spans.consumers.process_segments.enrich_spans")
def _enrich_spans(segment: Span | None, spans: list[Span]) -> None:
    """
    Enriches all spans with data derived from the span tree and the segment.

    This includes normalizations that need access to the spans' children, such
    as inferring `exclusive_time`, as well as normalizations that need access to
    the segment, such as extracting shared or conditional attributes.
    """

    for span in spans:
        sentry_tags = span.setdefault("sentry_tags", {})
        span["op"] = sentry_tags.get("op") or DEFAULT_SPAN_OP

    if segment:
        _set_shared_tags(segment, spans)

    _set_exclusive_time(spans)

    # Calculate grouping hashes for performance issue detection
    config = load_span_grouping_config()
    groupings = config.execute_strategy_standalone(spans)
    groupings.write_to_spans(spans)


def _set_shared_tags(segment: Span, spans: list[Span]) -> None:
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


def _set_exclusive_time(spans: list[Span]) -> None:
    """
    Sets the exclusive time on all spans in the list.

    The exclusive time is the time spent in a span's own code. This is the sum
    of all time intervals where no child span was active.
    """

    span_map: dict[str, list[tuple[float, float]]] = {}
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
        span["exclusive_time"] = exclusive_time_us / 1_000  # type: ignore[typeddict-unknown-key]
        span["exclusive_time_ms"] = exclusive_time_us / 1_000  # type: ignore[typeddict-unknown-key]


def _us(timestamp: float) -> int:
    """Convert the floating point duration or timestamp to integer microsecond
    precision."""
    return int(timestamp * 1_000_000)


@metrics.wraps("spans.consumers.process_segments.create_models")
def _create_models(segment: Span, project: Project) -> None:
    """
    Creates the Environment and Release models, along with the necessary
    relationships between them and the Project model.
    """

    # TODO: Read this from original data attributes.
    sentry_tags = segment.get("sentry_tags", {})
    environment_name = sentry_tags.get("environment")
    release_name = sentry_tags.get("release")
    dist_name = sentry_tags.get("dist")
    date = to_datetime(segment["end_timestamp_precise"])

    environment = Environment.get_or_create(project=project, name=environment_name)

    if not release_name:
        return

    try:
        release = Release.get_or_create(project=project, version=release_name, date_added=date)
    except ValidationError:
        logger.exception(
            "Failed creating Release due to ValidationError",
            extra={"project": project, "version": release_name},
        )
        return

    if dist_name:
        release.add_dist(dist_name)

    ReleaseEnvironment.get_or_create(
        project=project, release=release, environment=environment, datetime=date
    )

    ReleaseProjectEnvironment.get_or_create(
        project=project, release=release, environment=environment, datetime=date
    )

    # Record the release for dynamic sampling
    record_latest_release(project, release, environment)

    # Record onboarding signals
    record_release_received(project, release.version)


@metrics.wraps("spans.consumers.process_segments.detect_performance_problems")
def _detect_performance_problems(segment_span: Span, spans: list[Span], project: Project) -> None:
    if not options.get("standalone-spans.detect-performance-problems.enable"):
        return

    event_data = _build_shim_event_data(segment_span, spans)
    performance_problems = detect_performance_problems(event_data, project, standalone=True)

    if not options.get("standalone-spans.send-occurrence-to-platform.enable"):
        return

    # Prepare a slimmer event payload for the occurrence consumer. This event
    # will be persisted by the consumer. Once issue detectors can run on
    # standalone spans, we should directly build a minimal occurrence event
    # payload here, instead.
    event_data["spans"] = []
    event_data["timestamp"] = event_data["datetime"]

    for problem in performance_problems:
        problem.type = PerformanceStreamedSpansGroupTypeExperimental
        problem.fingerprint = (
            f"{problem.fingerprint}-{PerformanceStreamedSpansGroupTypeExperimental.type_id}"
        )

        occurrence = IssueOccurrence(
            id=uuid.uuid4().hex,
            resource_id=None,
            project_id=project.id,
            event_id=event_data["event_id"],
            fingerprint=[problem.fingerprint],
            type=problem.type,
            issue_title=problem.title,
            subtitle=problem.desc,
            culprit=event_data["transaction"],
            evidence_data=problem.evidence_data or {},
            evidence_display=problem.evidence_display,
            detection_time=to_datetime(segment_span["end_timestamp_precise"]),
            level="info",
        )

        produce_occurrence_to_kafka(
            payload_type=PayloadType.OCCURRENCE,
            occurrence=occurrence,
            event_data=event_data,
            is_buffered_spans=True,
        )


def _build_shim_event_data(segment_span: Span, spans: list[Span]) -> dict[str, Any]:
    sentry_tags = segment_span.get("sentry_tags", {})

    event: dict[str, Any] = {
        "type": "transaction",
        "level": "info",
        "contexts": {
            "trace": {
                "trace_id": segment_span["trace_id"],
                "type": "trace",
                "op": sentry_tags.get("transaction.op"),
                "span_id": segment_span["span_id"],
                "hash": segment_span["hash"],
            },
        },
        "event_id": uuid.uuid4().hex,
        "project_id": segment_span["project_id"],
        "transaction": sentry_tags.get("transaction"),
        "release": sentry_tags.get("release"),
        "dist": sentry_tags.get("dist"),
        "environment": sentry_tags.get("environment"),
        "platform": sentry_tags.get("platform"),
        "tags": [["environment", sentry_tags.get("environment")]],
        "received": segment_span["received"],
        "timestamp": segment_span["end_timestamp_precise"],
        "start_timestamp": segment_span["start_timestamp_precise"],
        "datetime": to_datetime(segment_span["end_timestamp_precise"]).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        ),
        "spans": [],
    }

    if (profile_id := segment_span.get("profile_id")) is not None:
        event["contexts"]["profile"] = {"profile_id": profile_id, "type": "profile"}

    # Add legacy span attributes required only by issue detectors. As opposed to
    # real event payloads, this also adds the segment span so detectors can run
    # topological sorting on the span tree.
    for span in spans:
        event_span = cast(dict[str, Any], deepcopy(span))
        event_span["start_timestamp"] = span["start_timestamp_precise"]
        event_span["timestamp"] = span["end_timestamp_precise"]
        event["spans"].append(event_span)

    return event


@metrics.wraps("spans.consumers.process_segments.record_signals")
def _record_signals(segment_span: Span, spans: list[Span], project: Project) -> None:
    # TODO: Make transaction name clustering work again
    # record_transaction_name_for_clustering(project, event.data)

    sentry_tags = segment_span.get("sentry_tags", {})

    record_generic_event_processed(
        project,
        platform=sentry_tags.get("platform"),
        release=sentry_tags.get("release"),
        environment=sentry_tags.get("environment"),
    )

    record_first_transaction(project, to_datetime(segment_span["end_timestamp_precise"]))

    for module, is_module in INSIGHT_MODULE_FILTERS.items():
        if not get_project_insight_flag(project, module) and is_module(spans):
            record_first_insight_span(project, module)
