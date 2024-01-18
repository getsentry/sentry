import datetime
import logging

from sentry.issues.grouptype import ReplayRageClickType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.replays.usecases.ingest.events import SentryEvent
from sentry.replays.usecases.issue import new_issue_occurrence

logger = logging.getLogger()


def report_rage_click_issue(project_id: int, replay_id: str, event: SentryEvent):
    payload = event["data"]["payload"]

    # Seconds since epoch is UTC.
    timestamp = datetime.datetime.fromtimestamp(payload["timestamp"])
    timestamp = timestamp.replace(tzinfo=datetime.timezone.utc)

    selector = payload["message"]
    clicked_element = selector.split(" > ")[-1]

    new_issue_occurrence(
        culprit=clicked_element,
        environment="prod",
        fingerprint=[selector],
        issue_type=ReplayRageClickType,
        level="warning",
        platform="javascript",
        project_id=project_id,
        subtitle=selector,
        timestamp=timestamp,
        title="Suspected Rage Click",
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
            "contexts": {"replay": {"replay_id": replay_id}},
            "level": "warning",
            "tags": {"replayId": replay_id, "url": payload["data"]["url"]},
            "user": {
                "id": "1",
                "username": "Test User",
                "email": "test.user@sentry.io",
            },
        },
    )
