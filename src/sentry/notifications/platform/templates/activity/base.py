from typing import Any

from sentry.notifications.platform.types import (
    CodeSection,
    CodeTextBlock,
    LinkTextBlock,
    NotificationData,
    NotificationSection,
    NotificationSource,
    NotificationTextBlock,
    ParagraphSection,
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

EXAMPLE_PROJECT_URL = "https://sentry.io/organizations/acme/issues/?project=123"
EXAMPLE_ISSUE_URL = "https://sentry.io/organizations/acme/issues/1/"
EXAMPLE_ALERT_URL = "https://sentry.io/organizations/acme/monitors/alerts/1/"
EXAMPLE_USER_SETTINGS_URL = "https://sentry.io/settings/account/notifications/alerts/"
FOOTER_DELIMITER = " · "


class ActivityNotificationData(NotificationData):
    source: NotificationSource
    notification_uuid: str
    activity_type: int
    activity_data: dict[str, Any] | None = None
    # The name of the user who is associated with an activity (Activity.user_id)
    activity_user_name: str | None = None
    issue_short_id: str | None = None
    issue_url: str
    issue_title: str
    issue_culprit: str | None = None
    issue_description: str | None = None
    project_slug: str
    project_url: str
    # If this notification was triggered by an alert (Workflow)...
    alert_name: str | None = None
    alert_url: str | None = None
    # If the target recipient is a user, this link will direct them to their notification preferences.
    user_settings_url: str | None = None


def create_activity_notification_example(
    activity_type: ActivityType,
    activity_data: dict[str, Any] | None = None,
) -> ActivityNotificationData:
    return ActivityNotificationData(
        notification_uuid="1234567890",
        activity_user_name="Jane Doe",
        issue_short_id="JAVASCRIPT-1",
        issue_url=EXAMPLE_ISSUE_URL,
        issue_title="ExampleError: something went wrong",
        issue_description="Cannot read properties of null (reading 'example_property')",
        issue_culprit="/api/v1/users/list/",
        project_slug="javascript",
        project_url=EXAMPLE_PROJECT_URL,
        alert_name="Notify #feed-issues via Slack",
        alert_url=EXAMPLE_ALERT_URL,
        source=ACTIVITY_TYPE_TO_SOURCE[activity_type.value],
        activity_type=activity_type.value,
        activity_data=activity_data,
        user_settings_url=EXAMPLE_USER_SETTINGS_URL,
    )


class SetResolvedInCommitNotificationData(ActivityNotificationData):
    commit_sha: str | None = None
    commit_message: str | None = None


class SetResolvedInReleaseNotificationData(ActivityNotificationData):
    release_url: str | None = None


def build_footer(data: ActivityNotificationData) -> list[NotificationTextBlock]:
    blocks: list[NotificationTextBlock] = [
        PlainTextBlock(text="Project:"),
        LinkTextBlock(text=data.project_slug, url=data.project_url),
    ]
    if data.alert_name and data.alert_url:
        blocks.append(PlainTextBlock(text=FOOTER_DELIMITER))
        blocks.append(PlainTextBlock(text="Alert:"))
        blocks.append(LinkTextBlock(text=data.alert_name, url=data.alert_url))
    if data.user_settings_url:
        blocks.append(PlainTextBlock(text=FOOTER_DELIMITER))
        blocks.append(LinkTextBlock(text="Manage Preferences", url=data.user_settings_url))
    return blocks


def build_issue_link(issue_short_id: str | None, issue_url: str) -> LinkTextBlock:
    label = issue_short_id or "This issue"
    return LinkTextBlock(text=label, url=issue_url)


def get_issue_description(data: ActivityNotificationData) -> list[NotificationSection]:
    blocks: list[NotificationTextBlock] = [LinkTextBlock(text=data.issue_title, url=data.issue_url)]
    if data.issue_culprit:
        blocks.extend([PlainTextBlock(text="—"), CodeTextBlock(text=data.issue_culprit)])
    sections: list[NotificationSection] = [ParagraphSection(blocks=blocks)]
    if data.issue_description:
        sections.append(CodeSection(blocks=[PlainTextBlock(text=data.issue_description)]))
    return sections
