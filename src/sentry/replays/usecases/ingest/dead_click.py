import datetime
import logging

from sentry.issues.grouptype import ReplayDeadClickType
from sentry.replays.usecases.ingest.events import SentryEvent
from sentry.replays.usecases.issue import new_issue_occurrence

logger = logging.getLogger()


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

    clicked_element = payload["message"].split(" > ")[-1]

    new_issue_occurrence(
        environment="prod",
        fingerprint=payload["message"],
        issue_type=ReplayDeadClickType,
        platform="javascript",
        project_id=project_id,
        subtitle=payload["message"],
        timestamp=timestamp,
        title="Suspected Dead Click",
        evidence_data={
            # RRWeb node data of clicked element.
            "node": payload["data"]["node"],
            # CSS selector path to clicked element.
            "selector": payload["message"],
        },
        evidence_display=[
            {
                "name": "Clicked Element",
                "value": clicked_element,
                "important": True,
            },
            {
                "name": "Selector Path",
                "value": payload["message"],
                "important": True,
            },
            {
                "name": "Page URL",
                "value": payload["data"]["url"],
                "important": True,
            },
        ],
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

    # Log dead click events.
    log = event["data"].get("payload", {}).copy()
    log["project_id"] = project_id
    log["replay_id"] = replay_id
    log["dom_tree"] = log.pop("message")
    logger.info("sentry.replays.dead_click", extra=log)

    return True
