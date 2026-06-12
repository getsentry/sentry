from typing import Any

from sentry_conventions.attributes import ATTRIBUTE_NAMES

from sentry.issue_detection.base import DetectorType
from sentry.issue_detection.performance_detection import get_detection_settings
from sentry.issue_detection.types import StandaloneSpan
from sentry.models.project import Project
from sentry.spans.consumers.process_segments.types import attribute_value

# We truncate evidence values to prevent hitting Kafka's broken message size limit.
# TODO: A better solution would be to audit the usage of `description`, `evidence_data` and
# `evidence_display` and deduplicate those keys. Right now they are nearly identical.
DEFAULT_MAX_EVIDENCE_VALUE_LENGTH = 10_000


def get_settings_for_detector(
    detector_type: DetectorType, project: Project | None = None
) -> dict[str, Any]:
    all_settings = get_detection_settings(project)
    return all_settings[detector_type]


def span_op(span: StandaloneSpan) -> str:
    return (attribute_value(span, ATTRIBUTE_NAMES.SENTRY_OP) or "").strip()


def span_description(span: StandaloneSpan) -> str:
    return (attribute_value(span, ATTRIBUTE_NAMES.SENTRY_DESCRIPTION) or "").strip()


def span_grouping_hash(span: StandaloneSpan) -> str:
    return (attribute_value(span, ATTRIBUTE_NAMES.SENTRY_GROUP) or "").strip()


def segment_transaction_name(segment_span: StandaloneSpan) -> str:
    return (attribute_value(segment_span, ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME) or "").strip()


def span_duration(span: StandaloneSpan) -> float:
    """Return span duration in ms"""
    return (span["end_timestamp"] - span["start_timestamp"]) * 1000


def span_evidence_value(op: str, description: str) -> str:
    """The 'op - description' string used as evidence in issue alerts."""
    if op and description:
        return f"{op} - {description}"
    return op or description or "no value"


def truncate(value: str, max_length: int = DEFAULT_MAX_EVIDENCE_VALUE_LENGTH) -> str:
    return value[:max_length]
