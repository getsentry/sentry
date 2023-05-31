import uuid
from typing import Any, Dict, Type

from sentry.issues.grouptype import GroupType
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import produce_occurrence_to_kafka


def new_issue_occurrence(
    environment: str,
    fingerprint: str,
    issue_type: Type[GroupType],
    platform: str,
    project_id: int,
    release: str,
    subtitle: str,
    timestamp: int,
    title: str,
    **extra_event_data: Dict[str, Any],
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
        level="warn",
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
    event_data.update(extra_event_data)

    produce_occurrence_to_kafka(occurrence, event_data=event_data)
