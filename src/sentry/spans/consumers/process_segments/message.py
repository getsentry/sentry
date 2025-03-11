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


class Span(SchemaSpan, total=False):
    start_timestamp_precise: float  # Missing in schema
    end_timestamp_precise: float  # Missing in schema
    op: str | None  # Added in enrichment
    hash: str | None  # Added in enrichment


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


def _enrich_spans(segment: Span | None, spans: list[Span]) -> None:
    for span in spans:
        if (op := span.get("sentry_tags", {}).get("op")) is not None:
            span["op"] = op

        # TODO: Add Relay's enrichment here.

    # Calculate grouping hashes for performance issue detection
    config = load_span_grouping_config()
    groupings = config.execute_strategy_standalone(spans)
    groupings.write_to_spans(spans)


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


def process_segment(spans: list[Span]) -> list[Span]:
    segment_span = _find_segment_span(spans)
    if segment_span is None:
        # TODO: Handle segments without a defined segment span once all
        # functions are refactored to a span interface.
        return spans

    with metrics.timer("tasks.spans.project.get_from_cache"):
        project = Project.objects.get_from_cache(id=segment_span["project_id"])

    _enrich_spans(segment_span, spans)
    _create_models(segment_span, project)
    _detect_performance_problems(segment_span, spans, project)
    _record_signals(segment_span, spans, project)

    return spans
