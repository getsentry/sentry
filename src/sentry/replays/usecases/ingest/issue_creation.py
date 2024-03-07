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
        platform="javascript",
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
            "contexts": {"replay": {"replay_id": replay_id}},
            "level": RAGE_CLICK_LEVEL,
            "tags": {"replayId": replay_id, "url": url},
            "user": replay_event["user"],
        },
    )
