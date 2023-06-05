import datetime
from typing import Any, Dict

from sentry.issues.grouptype import ReplayDeadClickType
from sentry.replays.usecases.ingest.events import SentryEvent
from sentry.replays.usecases.issue import new_issue_occurrence


def report_dead_click_issue(
    project_id: int,
    replay_id: str,
    event: SentryEvent,
    replay_event: Dict[str, Any],
) -> bool:
    payload = event["data"]["payload"]

    # Only timeout reasons on <a> and <button> tags are accepted.
    if payload["data"]["node"]["tagName"] not in ("a", "button"):
        return False
    elif payload["data"]["endReason"] != "timeout":
        return False

    # Seconds since epoch is UTC.
    timestamp = datetime.datetime.fromtimestamp(payload["timestamp"])
    timestamp = timestamp.replace(tzinfo=datetime.timezone.utc)

    # Deserialized replay_event payload key.
    replay_event_payload = replay_event.get("payload", {})

    # Modify the contexts object to ensure the replay_id key is included.
    contexts_data = replay_event_payload.get("contexts", {})
    if "replay" in contexts_data:
        contexts_data["replay"]["replay_id"] = replay_id
    else:
        contexts_data["replay"] = {"replay_id": replay_id}

    # Modify the tags object to ensure the replayId key is included.
    tags_data = replay_event_payload.get("tags", {})
    tags_data.update({"replayId": replay_id})

    _report_dead_click_issue(
        environment=replay_event_payload.get("platform", "javascript"),
        fingerprint=payload["message"],
        project_id=project_id,
        subtitle=payload["message"],
        timestamp=timestamp,
        extra_event_data={
            "contexts": contexts_data,
            "dist": replay_event_payload.get("dist", None),
            "environment": replay_event_payload.get("environment", None),
            "level": "warning",
            "release": replay_event_payload.get("release", None),
            "request": replay_event_payload.get("request", {}),
            "sdk": replay_event_payload.get("sdk", {}),
            "tags": tags_data,
            "user": replay_event_payload.get("user", {}),
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
