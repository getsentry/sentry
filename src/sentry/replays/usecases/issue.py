import uuid
from typing import Any, Dict, Type

from sentry.issues.grouptype import GroupType, ReplaySlowClickType
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import produce_occurrence_to_kafka


def new_sentry_slow_click_issue(fingerprint: str, project_id: int, timestamp: int) -> None:
    """Temporary measure.

    We don't have all of the metadata yet so we're going to emulate while we experiment. This
    is a simple wrapper around "new_slow_click_issue".
    """
    new_slow_click_issue(
        fingerprint=fingerprint,
        project_id=project_id,
        timestamp=timestamp,
        release="",
        environment="prod",
        user={"user": {"id": "1", "username": "Test User", "email": "test.user@sentry.io"}},
    )


def new_slow_click_issue(
    environment: str,
    fingerprint: str,
    project_id: int,
    release: str,
    timestamp: int,
    **extra_event_data: Dict[str, Any],
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
        **extra_event_data,
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
