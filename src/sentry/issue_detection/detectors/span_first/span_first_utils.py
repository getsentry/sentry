from __future__ import annotations

from typing import Any

from sentry_conventions.attributes import ATTRIBUTE_NAMES

from sentry.issue_detection.base import DetectorType
from sentry.issue_detection.performance_detection import get_detection_settings
from sentry.issue_detection.types import StandaloneSpan
from sentry.models.project import Project
from sentry.spans.consumers.process_segments.types import attribute_value
from sentry.utils.rollout import SafeRolloutComparator

# We truncate evidence values to prevent hitting Kafka's broken message size limit.
# TODO: A better solution would be to audit the usage of `description`, `evidence_data` and
# `evidence_display` and deduplicate those keys. Right now they are nearly identical.
DEFAULT_MAX_EVIDENCE_VALUE_LENGTH = 10_000


# Utility used to control sampling, metrics, comparison, and mismatch logging during rollout.
#
# Note: In all options relating to callsites, use `<detector_class>.grouptype.slug`. This means that
# detectors that share a grouptype (N+1 / MN+1 and SQL / Query injection) run as a unit, which keeps
# the parity comparison from spuriously flagging mismatches when one sibling is sampled and the
# other isn't.
class SpanFirstDetectorsRolloutController(SafeRolloutComparator):
    ROLLOUT_NAME = "span_first_detectors"
    # Log to Sentry only, so we don't have to worry about what we might be logging to an external
    # service when we log mismatches
    internal_logs_only = True


SPAN_FIRST_DETECTORS_ENABLEMENT_OPTION = (
    SpanFirstDetectorsRolloutController._should_run_experiment_option()
)


def get_settings_for_detector(
    detector_type: DetectorType, project: Project | None = None
) -> dict[str, Any]:
    all_settings = get_detection_settings(project)
    return all_settings[detector_type]


def get_op(span: StandaloneSpan) -> str:
    return (attribute_value(span, ATTRIBUTE_NAMES.SENTRY_OP) or "").strip()


def get_description(span: StandaloneSpan) -> str:
    return (attribute_value(span, ATTRIBUTE_NAMES.SENTRY_DESCRIPTION) or "").strip()


def get_grouping_hash(span: StandaloneSpan) -> str:
    # Note: This pulls the Sentry-computed hash that `SpanGroupingResults.write_to_spans` adds at
    # the top level of each span in `_enrich_spans`, rather than the Relay-computed
    # `attributes.sentry.group` (which Relay sets to `md5(scrubbed_description)` and which may or
    # may not match Sentry's grouping result exactly). Doing this keeps span-first-detector-
    # generated fingerprints equivalent to existing-detector-generated fingerprints during the
    # parity-comparison phase, since the existing detectors read the same top-level field. We may
    # want to revisit this once we're fully switched over.
    return (span.get("hash") or "").strip()


def get_segment_transaction(segment_span: StandaloneSpan) -> str:
    return (attribute_value(segment_span, ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME) or "").strip()


def get_duration(span: StandaloneSpan) -> float:
    """Return span duration in ms"""
    return (span["end_timestamp"] - span["start_timestamp"]) * 1000


def get_evidence_value(op: str, description: str) -> str:
    """The 'op - description' string used as evidence in issue alerts."""
    if op and description:
        return f"{op} - {description}"
    return op or description or "no value"


def truncate(value: str, max_length: int = DEFAULT_MAX_EVIDENCE_VALUE_LENGTH) -> str:
    return value[:max_length]
