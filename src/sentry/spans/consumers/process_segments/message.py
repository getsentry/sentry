import logging
import types
import uuid
from collections.abc import Mapping, Sequence
from typing import Any

import sentry_sdk
from django.conf import settings
from django.core.exceptions import ValidationError
from sentry_conventions.attributes import ATTRIBUTE_NAMES
from sentry_kafka_schemas.schema_types.ingest_spans_v1 import SpanEvent

from sentry import features, options
from sentry.constants import DataCategory
from sentry.dynamic_sampling.rules.helpers.latest_releases import record_latest_release
from sentry.event_manager import INSIGHT_MODULE_TO_PROJECT_FLAG_NAME
from sentry.ingest.transaction_clusterer.datasource import TRANSACTION_SOURCE_URL
from sentry.ingest.transaction_clusterer.datasource.redis import record_segment_name
from sentry.ingest.transaction_clusterer.normalization import normalize_segment_name
from sentry.insights import FilterSpan
from sentry.insights import modules as insights_modules
from sentry.issue_detection.performance_detection import detect_performance_problems
from sentry.issues.grouptype import PerformanceStreamedSpansGroupTypeExperimental
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.receivers.features import record_generic_event_processed
from sentry.receivers.onboarding import record_release_received
from sentry.signals import first_insight_span_received, first_transaction_received
from sentry.spans.consumers.process_segments.enrichment import TreeEnricher, compute_breakdowns
from sentry.spans.consumers.process_segments.shim import build_shim_event_data, make_compatible
from sentry.spans.consumers.process_segments.types import CompatibleSpan, attribute_value
from sentry.spans.grouping.api import load_span_grouping_config
from sentry.utils import metrics
from sentry.utils.dates import to_datetime
from sentry.utils.outcomes import Outcome, OutcomeAggregator
from sentry.utils.projectflags import set_project_flag_and_signal
from sentry.utils.safe import safe_execute

logger = logging.getLogger(__name__)

outcome_aggregator = OutcomeAggregator()


@metrics.wraps("spans.consumers.process_segments.process_segment")
def process_segment(
    unprocessed_spans: list[SpanEvent], skip_produce: bool = False
) -> list[CompatibleSpan]:
    sample_rate = (
        settings.SENTRY_PROCESS_SEGMENTS_TRANSACTIONS_SAMPLE_RATE
        * settings.SENTRY_PROCESS_EVENT_APM_SAMPLING
    )
    with sentry_sdk.start_transaction(
        name="spans.consumers.process_segments.process_segment",
        custom_sampling_context={
            "sample_rate": sample_rate,
        },
    ):
        return _process_segment(unprocessed_spans, skip_produce)


def _process_segment(
    unprocessed_spans: list[SpanEvent], skip_produce: bool
) -> list[CompatibleSpan]:
    _verify_compatibility(unprocessed_spans)
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

    safe_execute(_normalize_segment_name, segment_span, project)
    _add_segment_name(segment_span, spans)
    _compute_breakdowns(segment_span, spans, project)
    _create_models(segment_span, project)
    _detect_performance_problems(segment_span, spans, project)
    _record_signals(segment_span, spans, project)

    # XXX: This is disabled until the outcomes consumer can be scaled.
    # Only track outcomes if we're actually producing the spans
    # if not skip_produce:
    #     _track_outcomes(segment_span, spans)

    return spans


def _verify_compatibility(spans: Sequence[Mapping[str, Any]]) -> list[None | dict[str, Any]]:
    result: list[None | dict[str, Any]] = [None for span in spans]
    try:
        for i, span in enumerate(spans):
            # As soon as compatibility spans are fully rolled out, we can assert that attributes exist here.
            if "attributes" in span:
                metrics.incr("spans.consumers.process_segments.span_v2")

                attributes = span.get("attributes") or {}
                data = span.get("data") or {}
                # Verify that all data exist also in attributes.
                mismatches = [
                    (key, data_value, attribute_value)
                    for (key, data_value) in data.items()
                    if data_value != (attribute_value := (attributes.get(key) or {}).get("value"))
                ]
                if mismatches:
                    redacted = _redact(span)
                    logger.warning("Attribute mismatch", extra={"span": redacted})
                    result[i] = redacted
    except Exception as e:
        sentry_sdk.capture_exception(e)

    return result


def _redact(data: Any) -> Any:
    if isinstance(data, list):
        return [_redact(item) for item in data]
    elif isinstance(data, dict):
        return {key: _redact(value) for key, value in data.items()}
    elif isinstance(data, str):
        return "[redacted]"
    else:
        return data


@metrics.wraps("spans.consumers.process_segments.enrich_spans")
def _enrich_spans(
    unprocessed_spans: list[SpanEvent],
) -> tuple[CompatibleSpan | None, list[CompatibleSpan]]:
    """
    Enriches all spans with data derived from the span tree and the segment.

    This includes normalizations that need access to the spans' children, such
    as inferring `exclusive_time`, as well as normalizations that need access to
    the segment, such as extracting shared or conditional attributes.

    Returns the segment span, if any, and the list of enriched spans.
    """

    segment_idx, tree_spans = TreeEnricher.enrich_spans(unprocessed_spans)

    # Set attributes that are needed by logic shared with the event processing pipeline.
    spans = [make_compatible(span) for span in tree_spans]
    segment = spans[segment_idx] if segment_idx is not None else None

    # Calculate grouping hashes for performance issue detection
    config = load_span_grouping_config()
    groupings = config.execute_strategy_standalone(spans)
    groupings.write_to_spans(spans)

    return segment, spans


@metrics.wraps("spans.consumers.process_segments.normalize_segment_name")
@sentry_sdk.trace
def _normalize_segment_name(segment_span: CompatibleSpan, project: Project) -> None:
    if not features.has(
        "organizations:normalize_segment_names_in_span_enrichment", project.organization
    ):
        return

    segment_name = attribute_value(
        segment_span, ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME
    ) or segment_span.get("name")
    if not segment_name:
        return

    source = attribute_value(segment_span, ATTRIBUTE_NAMES.SENTRY_SPAN_SOURCE)
    unknown_if_parameterized = not source
    known_to_be_unparameterized = source == TRANSACTION_SOURCE_URL
    if unknown_if_parameterized or known_to_be_unparameterized:
        normalize_segment_name(project, segment_span)

    record_segment_name(project, segment_span)


@metrics.wraps("spans.consumers.process_segments.add_segment_name")
def _add_segment_name(segment: CompatibleSpan, spans: Sequence[CompatibleSpan]) -> None:
    segment_name = segment.get("name")
    if not segment_name:
        return

    for span in spans:
        if not attribute_value(span, ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME):
            span["attributes"] = span.get("attributes") or {}
            span["attributes"][ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME] = {  # type: ignore[index]
                "type": "string",
                "value": segment_name,
            }


@metrics.wraps("spans.consumers.process_segments.compute_breakdowns")
def _compute_breakdowns(
    segment: CompatibleSpan, spans: Sequence[CompatibleSpan], project: Project
) -> None:
    config = project.get_option("sentry:breakdowns")
    breakdowns = compute_breakdowns(spans, config)
    segment["attributes"] = segment.get("attributes") or {}
    segment["attributes"].update(breakdowns)  # type: ignore[union-attr]


@metrics.wraps("spans.consumers.process_segments.create_models")
def _create_models(segment: CompatibleSpan, project: Project) -> None:
    """
    Creates the Environment and Release models, along with the necessary
    relationships between them and the Project model.
    """
    environment_name = attribute_value(segment, ATTRIBUTE_NAMES.SENTRY_ENVIRONMENT)
    release_name = attribute_value(segment, ATTRIBUTE_NAMES.SENTRY_RELEASE)
    dist_name = attribute_value(segment, ATTRIBUTE_NAMES.SENTRY_DIST)
    date = to_datetime(segment["end_timestamp"])

    environment = Environment.get_or_create(project=project, name=environment_name)

    if not release_name:
        return

    try:
        release = Release.get_or_create(project=project, version=release_name, date_added=date)
    except ValidationError:
        # Avoid catching a stacktrace here, the codepath is very hot
        logger.warning(
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

    with metrics.timer("spans.consumers.process_segments.create_models.record_release"):
        # Record the release for dynamic sampling
        record_latest_release(project, release, environment)

        # Record onboarding signals
        record_release_received(project, release.version)


@metrics.wraps("spans.consumers.process_segments.detect_performance_problems")
def _detect_performance_problems(
    segment_span: CompatibleSpan, spans: list[CompatibleSpan], project: Project
) -> None:
    if not options.get("spans.process-segments.detect-performance-problems.enable"):
        return

    event_data = build_shim_event_data(segment_span, spans)
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
            detection_time=to_datetime(segment_span["end_timestamp"]),
            level="info",
        )

        produce_occurrence_to_kafka(
            payload_type=PayloadType.OCCURRENCE,
            occurrence=occurrence,
            event_data=event_data,
            is_buffered_spans=True,
        )


@metrics.wraps("spans.consumers.process_segments.record_signals")
def _record_signals(
    segment_span: CompatibleSpan, spans: list[CompatibleSpan], project: Project
) -> None:
    record_generic_event_processed(
        project,
        platform=attribute_value(segment_span, ATTRIBUTE_NAMES.SENTRY_PLATFORM),
        release=attribute_value(segment_span, ATTRIBUTE_NAMES.SENTRY_RELEASE),
        environment=attribute_value(segment_span, ATTRIBUTE_NAMES.SENTRY_ENVIRONMENT),
    )

    # signal expects an event like object with a datetime attribute
    event_like = types.SimpleNamespace(datetime=to_datetime(segment_span["end_timestamp"]))

    set_project_flag_and_signal(
        project,
        "has_transactions",
        first_transaction_received,
        event=event_like,
    )

    for module in insights_modules(
        [FilterSpan.from_span_attributes(span.get("attributes") or {}) for span in spans]
    ):
        set_project_flag_and_signal(
            project,
            INSIGHT_MODULE_TO_PROJECT_FLAG_NAME[module],
            first_insight_span_received,
            module=module,
        )


@metrics.wraps("spans.consumers.process_segments.record_outcomes")
def _track_outcomes(segment_span: CompatibleSpan, spans: list[CompatibleSpan]) -> None:
    outcome_aggregator.track_outcome_aggregated(
        org_id=segment_span["organization_id"],
        project_id=segment_span["project_id"],
        key_id=segment_span.get("key_id", None),
        outcome=Outcome.ACCEPTED,
        reason=None,
        timestamp=to_datetime(segment_span["received"]),
        category=DataCategory.SPAN_INDEXED,
        quantity=len(spans),
    )
