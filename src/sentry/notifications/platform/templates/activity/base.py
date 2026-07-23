from typing import Any
from urllib.parse import urlencode

from sentry.models.activity import Activity
from sentry.models.commit import Commit
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
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
from sentry.types.activity import SEER_ACTIVITY_TYPES, ActivityType
from sentry.users.services.user.service import user_service
from sentry.utils.http import absolute_uri
from sentry.workflow_engine.models import Workflow

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
    ActivityType.SET_REGRESSION.value: NotificationSource.ACTIVITY_SET_REGRESSION,
    ActivityType.SET_ESCALATING.value: NotificationSource.ACTIVITY_SET_ESCALATING,
    ActivityType.SET_IGNORED.value: NotificationSource.ACTIVITY_SET_IGNORED,
    ActivityType.SET_UNRESOLVED.value: NotificationSource.ACTIVITY_SET_UNRESOLVED,
    ActivityType.NOTE.value: NotificationSource.ACTIVITY_NOTE,
    ActivityType.ASSIGNED.value: NotificationSource.ACTIVITY_ASSIGNED,
    ActivityType.UNASSIGNED.value: NotificationSource.ACTIVITY_UNASSIGNED,
}

EXAMPLE_PROJECT_URL = "https://sentry.io/organizations/acme/issues/?project=123"
EXAMPLE_ISSUE_URL = "https://sentry.io/organizations/acme/issues/1/"
EXAMPLE_ALERT_URL = "https://sentry.io/organizations/acme/monitors/alerts/1/"
EXAMPLE_USER_SETTINGS_URL = "https://sentry.io/settings/account/notifications/alerts/"
FOOTER_DELIMITER = " · "


class ActivityNotificationData(NotificationData):
    source: NotificationSource
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


class AssignedNotificationData(ActivityNotificationData):
    assignee_label: str
    assignee_url: str | None = None


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


def extract_notification_models_by_activity(
    activity: Activity,
) -> tuple[Group, Project, Organization]:
    try:
        group = Group.objects.get_from_cache(id=activity.group_id)
    except Group.DoesNotExist:
        raise ValueError(f"Group not found: {activity.group_id}")
    try:
        project = Project.objects.get_from_cache(id=activity.project_id)
    except Project.DoesNotExist:
        raise ValueError(f"Project not found: {activity.project_id}")
    try:
        organization = Organization.objects.get_from_cache(id=project.organization_id)
    except Organization.DoesNotExist:
        raise ValueError(f"Organization not found: {project.organization_id}")

    return group, project, organization


def build_activity_notification_data(
    activity: Activity, *, workflow_id: int | None = None
) -> ActivityNotificationData:
    from sentry.integrations.messaging.message_builder import (
        build_attachment_text,
        build_attachment_title,
    )
    from sentry.notifications.notifications.activity.assigned import get_assignee_str

    source = ACTIVITY_TYPE_TO_SOURCE.get(activity.type)
    if source is None:
        raise ValueError(f"No notification source for activity type: {activity.type}")

    group, project, organization = extract_notification_models_by_activity(activity)

    workflow: Workflow | None = None
    if workflow_id:
        try:
            workflow = Workflow.objects.get(id=workflow_id, organization_id=organization.id)
        except Workflow.DoesNotExist:
            raise ValueError(f"Workflow not found: {workflow_id}")

    issue_url_params: dict[str, str] = {}
    if ActivityType(activity.type) in SEER_ACTIVITY_TYPES:
        issue_url_params.update({"seerDrawer": "true"})

    action_data = dict(
        source=source,
        activity_type=activity.type,
        issue_short_id=group.qualified_short_id,
        issue_url=absolute_uri(group.get_absolute_url(params=issue_url_params)),
        issue_title=build_attachment_title(group) or "",
        issue_culprit=group.culprit,
        issue_description=build_attachment_text(group),
        project_slug=project.slug,
        project_url=organization.absolute_url(
            f"organizations/{organization.slug}/issues/",
            query=urlencode({"project": project.id}),
        ),
        activity_data=activity.data,
        activity_user_name=None,
    )

    if workflow:
        action_data.update(
            {
                "alert_name": workflow.name,
                "alert_url": organization.absolute_url(
                    f"organizations/{organization.slug}/monitors/alerts/{workflow_id}/"
                ),
            }
        )

    if activity.user_id:
        user = user_service.get_user(user_id=activity.user_id)
        if user:
            action_data["activity_user_name"] = user.get_display_name()

    match activity.type:
        case ActivityType.SET_RESOLVED_IN_COMMIT.value:
            commit_sha = None
            commit_message = None
            if activity.data and "commit" in activity.data:
                try:
                    commit = Commit.objects.get(id=activity.data["commit"])
                    commit_sha = commit.short_id
                    commit_message = commit.message
                except Commit.DoesNotExist:
                    pass
            return SetResolvedInCommitNotificationData(
                **action_data, commit_sha=commit_sha, commit_message=commit_message
            )
        case ActivityType.SET_RESOLVED_IN_RELEASE.value:
            release_url = None
            # If version is missing, None or "" -> it was resolved in an upcoming release
            if activity.data and activity.data.get("version"):
                raw_version = activity.data["version"]
                release_url = organization.absolute_url(
                    f"organizations/{organization.slug}/releases/{raw_version}/",
                    query=urlencode({"project": project.id}),
                )
            return SetResolvedInReleaseNotificationData(**action_data, release_url=release_url)

        case ActivityType.ASSIGNED.value:
            assignee_label = get_assignee_str(activity=activity, organization=organization)
            assignee_email = activity.data.get("assigneeEmail") if activity.data else None
            assignee_url = None
            # TODO(Leander): If a team is assigned, maybe link to the team page?
            if assignee_email:
                assignee_url = f"mailto:{assignee_email}"
            return AssignedNotificationData(
                **action_data, assignee_label=assignee_label, assignee_url=assignee_url
            )
        case _:
            return ActivityNotificationData(**action_data)
