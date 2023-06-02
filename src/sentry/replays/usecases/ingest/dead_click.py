import datetime
from typing import Any, Dict

from sentry.issues.grouptype import ReplayDeadClickType
from sentry.replays.usecases.ingest.events import SentryEvent
from sentry.replays.usecases.issue import new_issue_occurrence


def report_dead_click_issue(project_id: int, replay_id: str, event: SentryEvent) -> bool:
    payload = event["data"]["payload"]

    # Only timeout reasons on <a> and <button> tags are accepted.
    if payload["data"]["node"]["tagName"] not in ("a", "button"):
        return False
    elif payload["data"]["endReason"] != "timeout":
        return False

    # Seconds since epoch is UTC.
    timestamp = datetime.datetime.fromtimestamp(payload["timestamp"])
    timestamp = timestamp.replace(tzinfo=datetime.timezone.utc)

    _report_dead_click_issue(
        environment="prod",
        fingerprint=payload["message"],
        project_id=project_id,
        subtitle=payload["message"],
        timestamp=timestamp,
        extra_event_data={
            "contexts": {"replay": {"replay_id": replay_id}},
            "level": "warning",
            "tags": {"replayId": replay_id},
            "user": {
                "id": "1",
                "username": "Test User",
                "email": "test.user@sentry.io",
            },
        },
    )

    return True


def _report_dead_click_issue(
    environment: str,
    fingerprint: str,
    project_id: int,
    subtitle: str,
    timestamp: datetime.datetime,
    extra_event_data: Dict[str, Any],
) -> None:
    """Produce a new dead click issue occurence to Kafka."""
    new_issue_occurrence(
        environment=environment,
        fingerprint=fingerprint,
        issue_type=ReplayDeadClickType,
        platform="javascript",
        project_id=project_id,
        subtitle=subtitle,
        timestamp=timestamp,
        title="[TEST] Dead Click Detected",
        extra_event_data=extra_event_data,
    )
