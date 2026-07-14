from typing import Any

from sentry.notifications.platform.types import (
    LinkTextBlock,
    NotificationData,
    NotificationSource,
    NotificationTextBlock,
    PlainTextBlock,
)
from sentry.types.activity import ActivityType

ACTIVITY_TYPE_TO_SOURCE: dict[int, NotificationSource] = {
    ActivityType.SEER_RCA_STARTED.value: NotificationSource.ACTIVITY_SEER_RCA_STARTED,
    ActivityType.SEER_RCA_COMPLETED.value: NotificationSource.ACTIVITY_SEER_RCA_COMPLETED,
    ActivityType.SEER_SOLUTION_STARTED.value: NotificationSource.ACTIVITY_SEER_SOLUTION_STARTED,
    ActivityType.SEER_SOLUTION_COMPLETED.value: NotificationSource.ACTIVITY_SEER_SOLUTION_COMPLETED,
    ActivityType.SEER_CODING_STARTED.value: NotificationSource.ACTIVITY_SEER_CODING_STARTED,
    ActivityType.SEER_CODING_COMPLETED.value: NotificationSource.ACTIVITY_SEER_CODING_COMPLETED,
    ActivityType.SEER_PR_CREATED.value: NotificationSource.ACTIVITY_SEER_PR_CREATED,
    ActivityType.SEER_ITERATION_STARTED.value: NotificationSource.ACTIVITY_SEER_ITERATION_STARTED,
    ActivityType.SEER_ITERATION_COMPLETED.value: NotificationSource.ACTIVITY_SEER_ITERATION_COMPLETED,
    ActivityType.SET_RESOLVED.value: NotificationSource.ACTIVITY_SET_RESOLVED,
    ActivityType.SET_RESOLVED_IN_RELEASE.value: NotificationSource.ACTIVITY_SET_RESOLVED_IN_RELEASE,
    ActivityType.SET_RESOLVED_BY_AGE.value: NotificationSource.ACTIVITY_SET_RESOLVED_BY_AGE,
    ActivityType.SET_RESOLVED_IN_COMMIT.value: NotificationSource.ACTIVITY_SET_RESOLVED_IN_COMMIT,
}

EXAMPLE_ISSUE_URL = "https://sentry.io/organizations/example/issues/1/"
EXAMPLE_ALERT_URL = "https://sentry.io/organizations/example/monitors/alerts/1/"


class ActivityAlertActionData(NotificationData):
    source: NotificationSource
    notification_uuid: str
    activity_type: int
    activity_data: dict[str, Any] | None = None
    activity_user_name: str | None = None
    issue_short_id: str | None = None
    issue_url: str
    issue_title: str
    issue_culprit: str | None = None
    alert_url: str


def create_activity_alert_example(
    activity_type: ActivityType,
    activity_data: dict[str, Any] | None = None,
) -> ActivityAlertActionData:
    return ActivityAlertActionData(
        notification_uuid="1234567890",
        activity_user_name="Jane Doe",
        issue_short_id="EXAMPLE-1",
        issue_url=EXAMPLE_ISSUE_URL,
        issue_title="ExampleError: something went wrong",
        issue_culprit="example.module.function",
        alert_url=EXAMPLE_ALERT_URL,
        source=ACTIVITY_TYPE_TO_SOURCE[activity_type.value],
        activity_type=activity_type.value,
        activity_data=activity_data,
    )


class SetResolvedInCommitActionData(ActivityAlertActionData):
    commit_sha: str | None = None
    commit_message: str | None = None


class SetResolvedInReleaseActionData(ActivityAlertActionData):
    release_url: str | None = None


def build_alert_footer(alert_url: str) -> list[NotificationTextBlock]:
    return [
        PlainTextBlock(text="This notification was sent as part of"),
        LinkTextBlock(text="an alert", url=alert_url),
    ]


def build_issue_link(issue_short_id: str | None, issue_url: str) -> LinkTextBlock:
    label = issue_short_id or "This issue"
    return LinkTextBlock(text=label, url=issue_url)
