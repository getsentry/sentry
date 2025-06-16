import logging
import types
import uuid
from copy import deepcopy
from typing import Any, cast

from django.core.exceptions import ValidationError
from sentry_kafka_schemas.schema_types.buffered_segments_v1 import SegmentSpan

from sentry import options
from sentry.constants import INSIGHT_MODULE_FILTERS
from sentry.dynamic_sampling.rules.helpers.latest_releases import record_latest_release
from sentry.event_manager import INSIGHT_MODULE_TO_PROJECT_FLAG_NAME
from sentry.issues.grouptype import PerformanceStreamedSpansGroupTypeExperimental
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.performance_issues.performance_detection import detect_performance_problems
from sentry.receivers.features import record_generic_event_processed
from sentry.receivers.onboarding import record_release_received
from sentry.signals import first_insight_span_received, first_transaction_received
from sentry.spans.consumers.process_segments.enrichment import (
    Enricher,
    Span,
    segment_span_measurement_updates,
)
from sentry.spans.grouping.api import load_span_grouping_config
from sentry.utils import metrics
from sentry.utils.dates import to_datetime
from sentry.utils.projectflags import set_project_flag_and_signal

logger = logging.getLogger(__name__)


@metrics.wraps("spans.consumers.process_segments.process_segment")
def process_segment(unprocessed_spans: list[SegmentSpan]) -> list[Span]:
    segment_span, spans = _enrich_spans(unprocessed_spans)
    if segment_span is None:
        return spans

    try:
        with metrics.timer("spans.consumers.process_segments.get_project"):
            project = Project.objects.get_from_cache(id=segment_span["project_id"])

            project.set_cached_field_value(
                "organization", Organization.objects.get_from_cache(id=project.organization_id)
            )
    except (Project.DoesNotExist, Organization.DoesNotExist):
        # If the project does not exist then it might have been deleted during ingestion.
        return []

    segment_span.setdefault("measurements", {}).update(
        segment_span_measurement_updates(
            segment_span,
            unprocessed_spans,
            project.get_option("sentry:breakdowns"),
        )
    )
    _create_models(segment_span, project)
    _detect_performance_problems(segment_span, spans, project)
    _record_signals(segment_span, spans, project)

    return spans


@metrics.wraps("spans.consumers.process_segments.enrich_spans")
def _enrich_spans(unprocessed_spans: list[SegmentSpan]) -> tuple[Span | None, list[Span]]:
    """
    Enriches all spans with data derived from the span tree and the segment.

    This includes normalizations that need access to the spans' children, such
    as inferring `exclusive_time`, as well as normalizations that need access to
    the segment, such as extracting shared or conditional attributes.

    Returns the segment span, if any, and the list of enriched spans.
    """

    segment, spans = Enricher.enrich_spans(unprocessed_spans)

    # Calculate grouping hashes for performance issue detection
    config = load_span_grouping_config()
    groupings = config.execute_strategy_standalone(spans)
    groupings.write_to_spans(spans)

    return segment, spans


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
    if not options.get("spans.process-segments.detect-performance-problems.enable"):
        return

    event_data = _build_shim_event_data(segment_span, spans)
    performance_problems = detect_performance_problems(event_data, project, standalone=True)

    if not segment_span.get("_performance_issues_spans"):
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
    sentry_tags = segment_span.get("sentry_tags", {})

    record_generic_event_processed(
        project,
        platform=sentry_tags.get("platform"),
        release=sentry_tags.get("release"),
        environment=sentry_tags.get("environment"),
    )

    # signal expects an event like object with a datetime attribute
    event_like = types.SimpleNamespace(datetime=to_datetime(segment_span["end_timestamp_precise"]))

    set_project_flag_and_signal(
        project,
        "has_transactions",
        first_transaction_received,
        event=event_like,
    )

    for module, is_module in INSIGHT_MODULE_FILTERS.items():
        if is_module(spans):
            set_project_flag_and_signal(
                project,
                INSIGHT_MODULE_TO_PROJECT_FLAG_NAME[module],
                first_insight_span_received,
                module=module,
            )
