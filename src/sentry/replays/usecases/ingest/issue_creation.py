import datetime
import logging
from typing import Any

from sentry.constants import MAX_CULPRIT_LENGTH
from sentry.issues.grouptype import ReplayRageClickType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.replays.usecases.issue import new_issue_occurrence
from sentry.utils import metrics

logger = logging.getLogger()

RAGE_CLICK_TITLE = "Rage Click"
RAGE_CLICK_LEVEL = "error"


def report_rage_click_issue_with_replay_event(
    project_id: int,
    replay_id: str,
    timestamp: float,
    selector: str,
    url: str,
    node: dict[str, Any],
    replay_event: dict[str, Any],
):
    metrics.incr("replay.rage_click_issue_creation_with_replay_event")

    # Seconds since epoch is UTC.
    date = datetime.datetime.fromtimestamp(timestamp)
    timestamp_utc = date.replace(tzinfo=datetime.UTC)

    selector = selector
    clicked_element = selector.split(" > ")[-1]

    new_issue_occurrence(
        culprit=url[:MAX_CULPRIT_LENGTH],
        environment=replay_event.get(
            "environment", "production"
        ),  # if no environment is set, default to production
        fingerprint=[selector],
        issue_type=ReplayRageClickType,
        level=RAGE_CLICK_LEVEL,
        platform=replay_event["platform"],
        project_id=project_id,
        subtitle=selector,
        timestamp=timestamp_utc,
        title=RAGE_CLICK_TITLE,
        evidence_data={
            # RRWeb node data of clicked element.
            "node": node,
            # CSS selector path to clicked element.
            "selector": selector,
        },
        evidence_display=[
            IssueEvidence(name="Clicked Element", value=clicked_element, important=True),
            IssueEvidence(name="Selector Path", value=selector, important=True),
        ],
        extra_event_data={
            "contexts": _make_contexts(replay_id, replay_event),
            "level": RAGE_CLICK_LEVEL,
            "tags": _make_tags(replay_id, url, replay_event),
            "user": replay_event["user"],
            "release": replay_event.get("release"),
            "sdk": replay_event.get("sdk"),
            "dist": replay_event.get("dist"),
        },
    )


def _make_contexts(replay_id, replay_event):
    contexts = {"replay": {"replay_id": replay_id}}
    if replay_event.get("contexts"):
        contexts.update(replay_event["contexts"])

    return contexts


def _make_tags(replay_id, url, replay_event):
    tags = {"replayId": replay_id, "url": url}
    if replay_event.get("tags"):
        tags.update(replay_event["tags"])

    return tags
