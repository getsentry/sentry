import datetime
import logging
from typing import Any, Dict, Optional, Type

from sentry.issues.grouptype import GroupType, ReplayDeadClickType, ReplayRageClickType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.replays.usecases.ingest.events import SentryEvent
from sentry.replays.usecases.issue import new_issue_occurrence

logger = logging.getLogger()


def report_dead_click_issue(
    project_id: int,
    replay_id: str,
    click_event: SentryEvent,
    replay_event: Optional[Dict[str, Any]] = None,
) -> bool:
    # Only timeout reasons on <a> and <button> tags are accepted.
    payload = click_event["data"]["payload"]
    if payload["data"]["endReason"] != "timeout":
        return False
    elif payload["data"]["node"]["tagName"] not in ("a", "button"):
        return False

    # Report the dead click issue.
    _report_click_issue(
        project_id,
        replay_id,
        click_event,
        "Suspected Dead Click",
        ReplayDeadClickType,
        replay_event,
    )

    _log_event("sentry.replays.dead_click", project_id, replay_id, click_event)

    return True


def report_rage_click_issue(
    project_id: int,
    replay_id: str,
    click_event: SentryEvent,
    replay_event: Optional[Dict[str, Any]] = None,
) -> bool:
    _report_click_issue(
        project_id,
        replay_id,
        click_event,
        "Suspected Rage Click",
        ReplayRageClickType,
        replay_event,
    )

    _log_event("sentry.replays.rage_click", project_id, replay_id, click_event)

    return True


def _report_click_issue(
    project_id: int,
    replay_id: str,
    click_event: SentryEvent,
    title: str,
    issue_type: Type[GroupType],
    replay_event: Optional[Dict[str, Any]],
) -> None:
    payload = click_event["data"]["payload"]
    replay_event = replay_event or _default_replay_event(replay_id, payload)

    contexts = replay_event.get("contexts", {}).copy()
    if "replay" in contexts:
        contexts["replay"].update({"replay_id": replay_id})
    else:
        contexts["replay"] = {"replay_id": replay_id}

    # Seconds since epoch is UTC.
    timestamp = datetime.datetime.fromtimestamp(payload["timestamp"])
    timestamp = timestamp.replace(tzinfo=datetime.timezone.utc)

    selector = payload["message"]
    clicked_element = selector.split(" > ")[-1]

    new_issue_occurrence(
        culprit=clicked_element,
        environment=replay_event["environment"],
        fingerprint=[selector],
        issue_type=issue_type,
        level="warning",
        platform=replay_event["platform"],
        project_id=project_id,
        subtitle=selector,
        timestamp=timestamp,
        title=title,
        evidence_data={
            # RRWeb node data of clicked element.
            "node": payload["data"]["node"],
            # CSS selector path to clicked element.
            "selector": selector,
        },
        evidence_display=[
            IssueEvidence(name="Clicked Element", value=clicked_element, important=True),
            IssueEvidence(name="Selector Path", value=selector, important=True),
            IssueEvidence(name="Page URL", value=payload["data"]["url"], important=True),
        ],
        extra_event_data={
            "contexts": contexts,
            "level": "warning",
            "tags": replay_event.get("tags", {}),
            "user": replay_event.get("user", {}),
        },
    )


def _log_event(message: str, project_id: int, replay_id: str, click_event: SentryEvent) -> None:
    log = click_event["data"].get("payload", {}).copy()
    log["project_id"] = project_id
    log["replay_id"] = replay_id
    log["dom_tree"] = log.pop("message")
    logger.info(message, extra=log)


def _default_replay_event(replay_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "platform": "javascript",
        "environment": "prod",
        "contexts": {"replay": {"replay_id": replay_id}},
        "tags": {"replayId": replay_id, "url": payload["data"]["url"]},
        "user": {
            "id": "1",
            "username": "Test User",
            "email": "test.user@sentry.io",
        },
    }
