import logging
from urllib.parse import urlencode

from sentry.integrations.messaging.message_builder import (
    build_attachment_text,
    build_attachment_title,
)
from sentry.models.activity import Activity
from sentry.models.commit import Commit
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.notifications.notification_action.registry import activity_handler_registry
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.templates.activity import (
    ACTIVITY_TYPE_TO_SOURCE,
    ActivityNotificationData,
    SetResolvedInCommitNotificationData,
    SetResolvedInReleaseNotificationData,
)
from sentry.notifications.platform.types import NotificationTarget
from sentry.types.activity import ActivityType
from sentry.users.services.user.service import user_service
from sentry.utils.http import absolute_uri
from sentry.workflow_engine.models import Action, Workflow
from sentry.workflow_engine.types import ActionInvocation

logger = logging.getLogger(__name__)


NOTIFICATION_PLATFORM_COMPATIBLE_ACTIVITIES = [
    ActivityType(value) for value in ACTIVITY_TYPE_TO_SOURCE
]


def get_supported_action_types() -> frozenset[Action.Type]:
    from sentry.notifications.notification_action.activity_registry.unsupported import (
        UnsupportedActivityHandler,
    )

    return frozenset(
        Action.Type(key)
        for key, handler in activity_handler_registry.registrations.items()
        if handler is not UnsupportedActivityHandler
    )


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
    invocation: ActionInvocation, activity: Activity
) -> ActivityNotificationData:
    source = ACTIVITY_TYPE_TO_SOURCE.get(activity.type)
    if source is None:
        raise ValueError(f"No notification source for activity type: {activity.type}")

    group, project, organization = extract_notification_models_by_activity(activity)

    try:
        workflow = Workflow.objects.get(id=invocation.workflow_id, organization_id=organization.id)
    except Workflow.DoesNotExist:
        raise ValueError(f"Workflow not found: {invocation.workflow_id}")

    action_data = dict(
        source=source,
        activity_type=activity.type,
        notification_uuid=invocation.notification_uuid,
        issue_short_id=group.qualified_short_id,
        issue_url=absolute_uri(group.get_absolute_url()),
        issue_title=build_attachment_title(group) or "",
        issue_culprit=group.culprit,
        issue_description=build_attachment_text(group),
        project_slug=project.slug,
        project_url=organization.absolute_url(
            f"organizations/{organization.slug}/issues/",
            query=urlencode({"project": project.id}),
        ),
        alert_url=organization.absolute_url(
            f"organizations/{organization.slug}/monitors/alerts/{invocation.workflow_id}/"
        ),
        alert_name=workflow.name,
        activity_data=activity.data,
        activity_user_name=None,
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
        case _:
            return ActivityNotificationData(**action_data)


def send_activity_notification(
    invocation: ActionInvocation,
    activity: Activity,
    target: NotificationTarget,
) -> None:
    data = build_activity_notification_data(invocation, activity)
    NotificationService[ActivityNotificationData](data=data).notify_sync(targets=[target])


def require_config(action: Action, key: str) -> str:
    value = action.config.get(key)
    if not value:
        raise ValueError(f"No {key} for action {action.id}")
    return value


def require_integration_id(action: Action) -> int:
    if action.integration_id is None:
        raise ValueError(f"No integration_id for action {action.id}")
    return action.integration_id
