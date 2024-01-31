import datetime
import logging

from sentry.issues.grouptype import ReplayRageClickType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.models.project import Project
from sentry.replays.query import query_replay_instance
from sentry.replays.usecases.ingest.events import SentryEvent
from sentry.replays.usecases.issue import new_issue_occurrence
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics

logger = logging.getLogger()

RAGE_CLICK_TITLE = "Suspected Rage Click"
RAGE_CLICK_LEVEL = "warning"


@instrumented_task(
    name="sentry.replays.usecases.ingest.issue_creation.report_rage_click_issue",
    queue="replays.ingest_replay",
    default_retry_delay=5,
    max_retries=5,
    silo_mode=SiloMode.REGION,
)
def report_rage_click_issue(project_id: int, replay_id: str, event: SentryEvent):
    metrics.incr("replay.rage_click_issue_creation")
    payload = event["data"]["payload"]

    project = Project.objects.get(id=project_id)

    # Seconds since epoch is UTC.
    timestamp = datetime.datetime.fromtimestamp(payload["timestamp"])
    timestamp = timestamp.replace(tzinfo=datetime.UTC)

    replay_info_list = query_replay_instance(
        project_id=project_id,
        replay_id=replay_id,
        start=timestamp - datetime.timedelta(hours=1),
        end=timestamp,
        organization=project.organization,
    )
    if not replay_info_list or len(replay_info_list) == 0:
        metrics.incr("replay.rage_click_issue_creation.no_replay_info")
        return

    replay_info = replay_info_list[0]

    selector = payload["message"]
    clicked_element = selector.split(" > ")[-1]

    new_issue_occurrence(
        culprit=payload["data"]["url"],
        environment=replay_info["agg_environment"],
        fingerprint=[selector],
        issue_type=ReplayRageClickType,
        level=RAGE_CLICK_LEVEL,
        platform="javascript",
        project_id=project_id,
        subtitle=selector,
        timestamp=timestamp,
        title=RAGE_CLICK_TITLE,
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
            "level": RAGE_CLICK_LEVEL,
            "tags": {"replayId": replay_id, "url": payload["data"]["url"]},
            "user": {
                "id": replay_info["user_id"],
                "username": replay_info["user_username"],
                "email": replay_info["user_email"],
                "ip": replay_info["user_ip"],
            },
        },
    )
