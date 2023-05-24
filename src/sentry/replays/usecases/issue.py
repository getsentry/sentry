import uuid
from typing import Type

from sentry.issues.grouptype import GroupType, ReplaySlowClickType
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import produce_occurrence_to_kafka


def new_slow_click_issue(
    environment: str,
    fingerprint: str,
    project_id: int,
    release: str,
    timestamp: int,
) -> None:
    """Produce a new slow click issue occurence to Kafka."""
    _new_issue_occurrence(
        environment=environment,
        fingerprint=fingerprint,
        issue_type=ReplaySlowClickType.type_id,
        platform="javascript",
        project_id=project_id,
        release=release,
        subtitle=ReplaySlowClickType.description,
        timestamp=timestamp,
        title="Slow Click Detected",
    )


def _new_issue_occurrence(
    environment: str,
    fingerprint: str,
    issue_type: Type[GroupType],
    platform: str,
    project_id: int,
    release: str,
    subtitle: str,
    timestamp: int,
    title: str,
) -> None:
    """Produce a new issue occurence to Kafka."""
    event_id = uuid.uuid4().hex

    occurrence = IssueOccurrence(
        id=uuid.uuid4().hex,
        project_id=project_id,
        event_id=event_id,
        fingerprint=fingerprint,
        issue_title=title,
        subtitle=subtitle,
        resource_id=None,
        evidence_data=[],
        evidence_display=[],
        type=issue_type,
        detection_time=timestamp,
        level="info",
        culprit=None,
    )

    event_data = {
        "id": event_id,
        "environment": environment,
        "platform": platform,
        "project_id": project_id,
        "received": timestamp,
        "release": release,
        "timestamp": timestamp,
    }

    produce_occurrence_to_kafka(occurrence, event_data=event_data)
