from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.notifications.platform.types import (
    LinkTextBlock,
    NotificationData,
    NotificationSource,
    NotificationTextBlock,
    PlainTextBlock,
)
from sentry.types.activity import ActivityType
from sentry.utils.http import absolute_uri

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


class ActivityAlertAction(NotificationData):
    source: NotificationSource
    workflow_id: int
    activity_id: int
    activity_type: int
    notification_uuid: str
    detector_id: int


def build_alert_footer(organization: Organization, workflow_id: int) -> list[NotificationTextBlock]:
    configuration_url = organization.absolute_url(
        f"organizations/{organization.slug}/monitors/alerts/{workflow_id}/"
    )
    return [
        PlainTextBlock(text="This notification was sent as part of"),
        LinkTextBlock(text="an alert", url=configuration_url),
    ]


def build_example_alert_footer() -> list[NotificationTextBlock]:
    return [
        PlainTextBlock(text="This notification was sent as part of"),
        LinkTextBlock(text="an alert", url=EXAMPLE_ALERT_URL),
    ]


def build_issue_link(group: Group) -> LinkTextBlock:
    group_label = group.qualified_short_id or "This issue"
    return LinkTextBlock(text=group_label, url=absolute_uri(group.get_absolute_url()))


def build_example_issue_link() -> LinkTextBlock:
    return LinkTextBlock(text="EXAMPLE-1", url=EXAMPLE_ISSUE_URL)
