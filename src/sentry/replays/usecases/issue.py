import datetime
import uuid
from typing import Any, Dict, List, Optional, Sequence, Type

from sentry.issues.grouptype import GroupType
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka


def new_issue_occurrence(
    culprit: str,
    environment: str,
    fingerprint: Sequence[str],
    issue_type: Type[GroupType],
    level: str,
    platform: str,
    project_id: int,
    subtitle: str,
    timestamp: datetime.datetime,
    title: str,
    extra_event_data: Dict[str, Any],
    evidence_data: Optional[Dict[str, Any]] = None,
    evidence_display: Optional[List[IssueEvidence]] = None,
) -> None:
    """Produce a new issue occurrence to Kafka."""
    event_id = uuid.uuid4().hex
    extra_event_data["event_id"] = event_id

    occurrence = IssueOccurrence(
        id=uuid.uuid4().hex,
        project_id=project_id,
        event_id=event_id,
        fingerprint=fingerprint,
        issue_title=title,
        subtitle=subtitle,
        resource_id=None,
        evidence_data=evidence_data or {},
        evidence_display=evidence_display or [],
        type=issue_type,
        detection_time=timestamp,
        culprit=culprit,
        level=level,
    )

    event_data = {
        "id": event_id,
        "environment": environment,
        "platform": platform,
        "project_id": project_id,
        "received": timestamp.isoformat(),
        "tags": {},
        "timestamp": timestamp.isoformat(),
    }
    event_data.update(extra_event_data)

    produce_occurrence_to_kafka(
        payload_type=PayloadType.OCCURRENCE, occurrence=occurrence, event_data=event_data
    )
