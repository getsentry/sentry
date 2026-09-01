import logging
import types
import uuid
from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any

import sentry_sdk
from django.core.exceptions import ValidationError
from sentry_conventions.attributes import ATTRIBUTE_NAMES
from sentry_kafka_schemas.schema_types.ingest_spans_v1 import SpanEvent

from sentry import features, options
from sentry.ai_monitoring.tasks import spawn_conversation_title_generation
from sentry.constants import DataCategory
from sentry.dynamic_sampling.rules.helpers.latest_releases import record_latest_release
from sentry.event_manager import INSIGHT_MODULE_TO_PROJECT_FLAG_NAME
from sentry.insights import FilterSpan
from sentry.insights import modules as insights_modules
from sentry.issue_detection import performance_detection
from sentry.issue_detection.base import DetectorType
from sentry.issue_detection.detectors.span_first.run_detectors import (
    SPAN_FIRST_DETECTORS_BY_GROUPTYPE,
    compare_span_first_problems_to_control_data,
    run_span_first_detectors,
)
from sentry.issue_detection.detectors.span_first.span_first_utils import (
    SPAN_FIRST_DETECTORS_ENABLEMENT_OPTION,
    SpanFirstDetectorsRolloutController,
)
from sentry.issue_detection.performance_detection import (
    DETECTOR_TYPE_TO_CLASS_MAP,
    detect_performance_problems,
    get_detection_settings,
)
from sentry.issue_detection.performance_problem import PerformanceProblem
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.killswitches import killswitch_matches_context
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.receivers.features import record_generic_event_processed
from sentry.receivers.onboarding import record_release_received
from sentry.releases.auto_creation import should_auto_create_releases
from sentry.signals import first_insight_span_received, first_transaction_received
from sentry.spans.consumers.process_segments.enrichment import TreeEnricher, compute_breakdowns
from sentry.spans.consumers.process_segments.shim import build_shim_event_data, make_compatible
from sentry.spans.consumers.process_segments.types import CompatibleSpan, attribute_value
from sentry.spans.grouping.api import load_span_grouping_config
from sentry.utils import metrics
from sentry.utils.dates import to_datetime
from sentry.utils.last_seen import LAST_SEEN_INTERVAL_SECONDS
from sentry.utils.local_cache import LRUCache, SizedKeyCache, ThreadSafeCache
from sentry.utils.outcomes import Outcome, OutcomeAggregator
from sentry.utils.projectflags import set_project_flag_and_signal

logger = logging.getLogger(__name__)

outcome_aggregator = OutcomeAggregator()

# This set of constants helps us keep occurrence data within the occurrence consumer's limits.
# Limits on span count are split into overall and context (parent and cause) span limits in order to
# prioritize offender spans, because they're the ones containing the actual problems we report.
OVERALL_MAX_EVIDENCE_SPANS = 100
MAX_EVIDENCE_CONTEXT_SPANS = 10
MAX_SPAN_DESCRIPTION_LENGTH = 2048
MAX_SPAN_DATA_VALUE_LENGTH = 500
MAX_EVIDENCE_VALUE_LENGTH = 500
MAX_EVIDENCE_LIST_ITEMS = 100

# The `evidence_data` values we actually use for issue details and Seer - all others are dropped
# when we produce the occurrence
EVIDENCE_SPAN_DATA_KEYS = frozenset(
    (
        "code.filepath",
        "code.function",
        "code.lineno",
        "http.query",
        "http.request.request_start",
        "http.request.response_start",
        "http.response_content_length",
        "url",
    )
)


@metrics.wraps("spans.consumers.process_segments.process_segment")
def process_segment(
    unprocessed_spans: list[SpanEvent],
    skip_enrichment: bool = False,
) -> list[CompatibleSpan]:
    return _process_segment(unprocessed_spans, skip_enrichment)


def _process_segment(
    unprocessed_spans: list[SpanEvent], skip_enrichment: bool
) -> list[CompatibleSpan]:
    _verify_compatibility(unprocessed_spans)

    project = None
    if unprocessed_spans:
        project_id = unprocessed_spans[0].get("project_id")
        if project_id is not None:
            try:
                with metrics.timer("spans.consumers.process_segments.get_project"):
                    project = Project.objects.get_from_cache(id=project_id)
                    project.set_cached_field_value(
                        "organization",
                        Organization.objects.get_from_cache(id=project.organization_id),
                    )
            except (Project.DoesNotExist, Organization.DoesNotExist):
                return []

    if project is None:
        # If the project does not exist then it might have been deleted during ingestion.
        return []

    if killswitch_matches_context(
        "spans.process-segments.drop-segments",
        {"org_id": str(project.organization_id)},
        emit_metrics=True,
    ):
        return []

    # Always attempt title generation, even when enrichment is skipped below.
    spawn_conversation_title_generation(unprocessed_spans, project)

    if skip_enrichment:
        return [make_compatible(span) for span in unprocessed_spans]

    if unprocessed_spans:
        project_id = unprocessed_spans[0].get("project_id")
        if project_id in options.get("spans.process-segments.skip-enrichment-projects"):
            return [make_compatible(span) for span in unprocessed_spans]

    segment_span, spans = _enrich_spans(unprocessed_spans)
    if segment_span is None:
        return spans

    _add_segment_name(segment_span, spans)
    _compute_breakdowns(segment_span, spans, project)

    environment_name = attribute_value(segment_span, ATTRIBUTE_NAMES.SENTRY_ENVIRONMENT)
    release_name = attribute_value(segment_span, ATTRIBUTE_NAMES.SENTRY_RELEASE)
    dist_name = attribute_value(segment_span, ATTRIBUTE_NAMES.SENTRY_DIST)
    date = to_datetime(segment_span["end_timestamp"])

    cache_key = f"{project.id}:{_to_string(environment_name)}:{_to_string(release_name)}:{_to_string(dist_name)}"

    cache = _get_cache()
    cache_metric_name = "spans.consumers.process_segments.cache"
    cached_timestamp = cache.get(cache_key)
    timestamp = int(date.timestamp())

    # If no cached value exists this is the first time we've seen this combination. Here
    # we follow the maximalist path. Models are created and onboarding signals issued.
    if cached_timestamp is None:
        _create_models(project, environment_name, release_name, dist_name, date)
        cache[cache_key] = timestamp
        metrics.incr(cache_metric_name, tags={"outcome": "miss"})
    # If a cached value was found and the timestamp specified by the current event exceeds
    # the previously cached timestamp by at least `LAST_SEEN_INTERVAL_SECONDS` then we
    # perform small mutations on select models. From the code in this module this may appear
    # to only save one or two cache lookups, however, certain billing logic tied to the
    # feature flag check runs when this program is executed in getsentry. In the minimal
    # case its three extra saved queries but up to six additional cache lookups have been
    # observed.
    elif timestamp - LAST_SEEN_INTERVAL_SECONDS >= cached_timestamp:
        _bump_release_last_seen(project, environment_name, release_name, date)
        cache[cache_key] = timestamp
        metrics.incr(cache_metric_name, tags={"action": "bump", "outcome": "hit"})
    # If a cached value was found and the timestamp does NOT exceed the interval then we
    # do nothing! This should be the majority of events.
    else:
        metrics.incr(cache_metric_name, tags={"action": "noop", "outcome": "hit"})

    _detect_performance_problems(segment_span, spans, project)
    _record_signals(segment_span, spans, project)

    # XXX: This is disabled until the outcomes consumer can be scaled.
    # _track_outcomes(segment_span, spans)

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
    child_spans = [s for s in spans if not s.get("is_segment")]
    breakdowns = compute_breakdowns(child_spans, config)
    segment["attributes"] = segment.get("attributes") or {}
    segment["attributes"].update(breakdowns)  # type: ignore[union-attr]


@metrics.wraps("spans.consumers.process_segments.create_models")
def _create_models(
    project: Project, environment_name: Any, release_name: Any, dist_name: Any, date: datetime
) -> None:
    """
    Creates the Environment and Release models, along with the necessary
    relationships between them and the Project model.
    """
    environment = Environment.get_or_create(project=project, name=environment_name)

    if not release_name:
        return

    try:
        release = Release.get_or_create(
            project=project,
            version=release_name,
            date_added=date,
            create=should_auto_create_releases(project),
        )
    except ValidationError:
        # Avoid catching a stacktrace here, the codepath is very hot
        logger.warning(
            "Failed creating Release due to ValidationError",
            extra={"project": project, "version": release_name},
        )
        return

    if release is None:
        metrics.incr("spans.consumers.process_segments.release_autocreation_skipped")
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
    enabled_legacy_detector_types = options.get(
        "spans.process-segments.detect-performance-problems.detectors-enabled"
    )

    if not enabled_legacy_detector_types:
        return

    try:
        # Run the legacy detectors and, possibly produce occurrences from the results (depending on
        # conditions explained in `_run_legacy_detectors`)
        detection_settings = get_detection_settings(project)
        legacy_detected_problems = _run_legacy_detectors(
            segment_span, spans, project, enabled_legacy_detector_types, detection_settings
        )
    except Exception:
        logger.exception("segment_consumer_legacy_issue_detectors.error")
        # If the legacy detectors error out, there's no point in running the experiment, so bail now
        return

    # Run the new span-first detectors and compare their results to those of the legacy detectors.
    # Note: Not all legacy detectors have span-first analogs yet. Results from those that don't are
    # just ignored in the comparison.
    _maybe_run_span_first_detector_parity_check(
        segment_span, spans, project, legacy_detected_problems, detection_settings
    )


def _run_legacy_detectors(
    segment_span: CompatibleSpan,
    segment: list[CompatibleSpan],
    project: Project,
    detector_types: list[str],
    detection_settings: dict[DetectorType, dict[str, Any]],
) -> list[PerformanceProblem]:
    """
    Run legacy issue detectors corresponding to the given detector types on segment data by first
    creating a fake transaction event. If the right conditions hold (see below), create issue
    occurrences from any detected problems.
    """
    # Create a fake transaction event out of the segment data, to match what the legacy detectors
    # are expecting
    event_data = build_shim_event_data(segment_span, segment)

    # Resolve the detector type strings into actual detector classes, and warn if we find anything
    # weird
    if detector_types == ["*"]:
        detector_classes = performance_detection.DETECTOR_CLASSES
    else:
        detector_classes = [
            DETECTOR_TYPE_TO_CLASS_MAP[detector_type]
            for detector_type in detector_types
            # They should all be in there, but in case we typo an option value, best to be safe
            if detector_type in DETECTOR_TYPE_TO_CLASS_MAP
        ]
        if len(detector_types) > len(detector_classes):
            logger.warning(
                "issue_detection.span_processor.invalid_enablement_option",
                extra={"option_value": detector_types},
            )

    detected_problems = detect_performance_problems(
        event_data,
        project,
        detector_classes=detector_classes,
        detection_settings=detection_settings,
        standalone=True,
    )

    # If we didn't find anything, it's not worth going through all the "can we save occurrences"
    # checks below, because there's nothing to save
    if not detected_problems:
        return []

    # Whether or not we create issue occurrences from the problems we've found depends on two
    # factors:
    #
    #  - The `organizations:performance-issues-spans` feature flag, which must be on for occurrences
    #    to be created.
    #
    #  - Whether or not the occurrence might already have been created via
    #    `save_transaction_events`. If it might have, we don't create the occurrence, because we
    #    don't want duplicates. (The reason we say "might have" rather than "did" is because there
    #    are delays built into both the propagation of feature flags to Relay's cache and the
    #    buffering of segment data, and together those mean that when the relevant feature flags are
    #    flipped in either direction, checks in Relay and checks in `save_transaction_events` and
    #    checks here won't give the same answers until all the data sources are reconciled.)
    #
    #    In order for it to be possible for a transaction version of this segment's data to have
    #    already created an occurrence we need the following:
    #      a) there has to be a transaction,
    #      b) that transaction has to reach `save_transaction_events`
    #      c) when it does, `save_transaction_events` has to not skip occurrence creation
    #    which corresponds to the following conditions:
    #      a) the segment span has an event id (only exists if copied from a transaction event)
    #      b) the discard transactions flag is off for the project
    #      c) the `_performance_issues_spans` flag (set by relay on transaction and segment) is falsy
    #    And then if those hold, we don't create an occurrence here, because we don't want to have
    #    duplicate occurrence records.
    #
    # To allow us to short circuit and save calls to `features.has`, we check both of the data-based
    # conditions (event id and `_performance_issues_spans` flag) before checking either of the
    # feature-flag-based conditions.

    transaction_occurrence_creation_possible = (
        segment_span.get("event_id") is not None
        and not segment_span.get("_performance_issues_spans")
        and not features.has("projects:discard-transaction", project)
    )

    if transaction_occurrence_creation_possible or not features.has(
        "organizations:performance-issues-spans", project.organization
    ):
        return detected_problems

    # Produce an occurrence for each problem, first filtering and trimming data to stay within the
    # occurrence consumer's limits
    spans_by_id = {span["span_id"]: span for span in event_data["spans"]}
    for problem in detected_problems:
        evidence_display = [
            IssueEvidence(
                evidence.name,
                _truncate_value_for_occurrence(evidence.value, MAX_EVIDENCE_VALUE_LENGTH),
                evidence.important,
            )
            for evidence in problem.evidence_display
        ]
        evidence_data = _get_evidence_data_for_occurrence(problem, spans_by_id)

        occurrence_id = uuid.uuid4().hex
        occurrence_spans = [
            _get_evidence_span_for_occurrence(spans_by_id[id])
            # We use `dict.fromkeys` here to preserve ordering
            for id in dict.fromkeys(
                (
                    *evidence_data["parent_span_ids"],
                    *evidence_data["cause_span_ids"],
                    *evidence_data["offender_span_ids"],
                )
            )
        ]
        occurrence_event_data = {
            **event_data,
            "event_id": occurrence_id,
            "spans": occurrence_spans,
        }

        occurrence = IssueOccurrence(
            id=occurrence_id,
            resource_id=None,
            project_id=project.id,
            event_id=occurrence_id,
            fingerprint=[problem.fingerprint],
            type=problem.type,
            issue_title=problem.title,
            subtitle=_truncate_value_for_occurrence(problem.desc, MAX_EVIDENCE_VALUE_LENGTH),
            culprit=event_data["transaction"],
            evidence_data=evidence_data,
            evidence_display=evidence_display,
            detection_time=to_datetime(segment_span["end_timestamp"]),
            level="info",
        )

        produce_occurrence_to_kafka(
            payload_type=PayloadType.OCCURRENCE,
            occurrence=occurrence,
            event_data=occurrence_event_data,
        )

    return detected_problems


def _truncate_span_id_list(
    raw_span_ids: Sequence[str], spans_by_id: dict[str, Any], max_span_ids: int
) -> list[str]:
    """
    Drop ids the segment has no span for (so performance problem evidence never references a missing
    span), and then truncate the list of ids to the given max length.
    """
    ids_for_existing_spans = [span_id for span_id in raw_span_ids if span_id in spans_by_id]
    return ids_for_existing_spans[:max_span_ids]


def _get_evidence_data_for_occurrence(
    problem: PerformanceProblem, spans_by_id: dict[str, Any]
) -> dict[str, Any]:
    # For the three lists of span ids, remove any which points to spans we don't have and then cap
    # the list length. The three lists can overlap, so the cap on offender span ids may be more
    # conservative than necessary, but better that than create an occurrence which gets rejected.
    parent_span_ids = _truncate_span_id_list(
        problem.parent_span_ids, spans_by_id, MAX_EVIDENCE_CONTEXT_SPANS
    )
    cause_span_ids = _truncate_span_id_list(
        problem.cause_span_ids, spans_by_id, MAX_EVIDENCE_CONTEXT_SPANS
    )
    max_offender_spans = OVERALL_MAX_EVIDENCE_SPANS - len(parent_span_ids) - len(cause_span_ids)
    offender_span_ids = _truncate_span_id_list(
        problem.offender_span_ids, spans_by_id, max_offender_spans
    )

    # Now trim the rest of the evidence data
    evidence_data = problem.evidence_data or {}
    span_id_keys = {"parent_span_ids", "cause_span_ids", "offender_span_ids"}
    non_span_id_evidence_data = {
        key: value for key, value in evidence_data.items() if key not in span_id_keys
    }
    trimmed_non_span_id_evidence_data = _truncate_value_for_occurrence(
        non_span_id_evidence_data, MAX_EVIDENCE_VALUE_LENGTH
    )

    return {
        **trimmed_non_span_id_evidence_data,
        "parent_span_ids": parent_span_ids,
        "cause_span_ids": cause_span_ids,
        "offender_span_ids": offender_span_ids,
    }


def _truncate_value_for_occurrence(
    value: Any, max_chars: int, max_items: int = MAX_EVIDENCE_LIST_ITEMS
) -> Any:
    """
    Create a recursively-trimmed copy of a value for use in issue occurrences.
    """
    if isinstance(value, str):
        return value[:max_chars]
    if isinstance(value, list | tuple):
        return [
            _truncate_value_for_occurrence(inner_value, max_chars, max_items)
            for inner_value in value[:max_items]
        ]
    if isinstance(value, dict):
        return {
            key: _truncate_value_for_occurrence(inner_value, max_chars, max_items)
            for key, inner_value in value.items()
        }
    return value


def _get_evidence_span_for_occurrence(span: dict[str, Any]) -> dict[str, Any]:
    trimmed_description = _truncate_value_for_occurrence(
        span.get("description"), MAX_SPAN_DESCRIPTION_LENGTH
    )
    # Only keep the `data` entries we actually need for evidence data
    filtered_data = {
        key: _truncate_value_for_occurrence(value, MAX_SPAN_DATA_VALUE_LENGTH)
        for key, value in (span.get("data") or {}).items()
        if key in EVIDENCE_SPAN_DATA_KEYS
    }

    return {
        "span_id": span["span_id"],
        "trace_id": span.get("trace_id"),
        "op": span.get("op"),
        "description": trimmed_description,
        "start_timestamp": span.get("start_timestamp"),
        "timestamp": span.get("timestamp"),
        "exclusive_time": span.get("exclusive_time"),
        "data": filtered_data,
    }


def _maybe_run_span_first_detector_parity_check(
    segment_span: CompatibleSpan,
    segment: list[CompatibleSpan],
    project: Project,
    all_control_problems: list[PerformanceProblem],
    detection_settings: dict[DetectorType, dict[str, Any]],
) -> None:
    if not options.get(SPAN_FIRST_DETECTORS_ENABLEMENT_OPTION):
        return

    sampled_grouptypes = [
        grouptype_slug
        for grouptype_slug in SPAN_FIRST_DETECTORS_BY_GROUPTYPE
        if SpanFirstDetectorsRolloutController.should_check_experiment(grouptype_slug)
    ]
    if not sampled_grouptypes:
        return

    try:
        span_first_problems_by_grouptype = run_span_first_detectors(
            sampled_grouptypes, segment_span, segment, detection_settings
        )

        compare_span_first_problems_to_control_data(
            project,
            segment_span["trace_id"],
            span_first_problems_by_grouptype,
            all_control_problems,
        )
    except Exception:
        logger.exception("span_first_detector_test.error")


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
        [
            FilterSpan.from_span_attributes(
                span.get("attributes") or {}, is_segment=span.get("is_segment")
            )
            for span in spans
        ]
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


@metrics.wraps("spans.consumers.process_segments.bump_release_last_seen")
def _bump_release_last_seen(
    project: Project, environment_name: Any, release_name: Any, date: datetime
) -> None:
    if not release_name:
        return

    environment = Environment.get_or_create(project=project, name=environment_name)

    try:
        release = Release.get_or_create(
            project=project,
            version=release_name,
            date_added=date,
            create=should_auto_create_releases(project),
        )
    except ValidationError:
        return

    if release is None:
        metrics.incr("spans.consumers.process_segments.release_autocreation_skipped")
        return

    # Bumps release-environment last-seen.
    ReleaseEnvironment.get_or_create(
        project=project, release=release, environment=environment, datetime=date
    )

    # Bumps release-project-environment last-seen.
    ReleaseProjectEnvironment.get_or_create(
        project=project, release=release, environment=environment, datetime=date
    )


def _to_string(s: Any) -> str:
    return s if isinstance(s, str) else ""


def _get_cache() -> SizedKeyCache[int]:
    global cache
    if cache is None:
        cache = SizedKeyCache[int](ThreadSafeCache(LRUCache(maxlen=100_000)))
    return cache


cache: SizedKeyCache[int] | None = None
