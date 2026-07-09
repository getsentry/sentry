import logging

from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.notifications.notification_action.registry import activity_handler_registry
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.templates.workflow_engine import (
    ACTIVITY_TYPE_TO_SOURCE,
    ActivityAlertAction,
)
from sentry.notifications.platform.types import NotificationTarget
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Action
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


def build_activity_data(invocation: ActionInvocation, activity: Activity) -> ActivityAlertAction:
    detector = invocation.detector

    source = ACTIVITY_TYPE_TO_SOURCE.get(activity.type)
    if source is None:
        raise ValueError(f"No notification source for activity type: {activity.type}")

    return ActivityAlertAction(
        source=source,
        workflow_id=invocation.workflow_id,
        activity_type=activity.type,
        activity_id=activity.id,
        notification_uuid=invocation.notification_uuid,
        detector_id=detector.id,
    )


def send_activity_notification(
    invocation: ActionInvocation,
    activity: Activity,
    target: NotificationTarget,
) -> None:
    data = build_activity_data(invocation, activity)
    NotificationService[ActivityAlertAction](data=data).notify_sync(targets=[target])


def require_config(action: Action, key: str) -> str:
    value = action.config.get(key)
    if not value:
        raise ValueError(f"No {key} for action {action.id}")
    return value


def require_integration_id(action: Action) -> int:
    if action.integration_id is None:
        raise ValueError(f"No integration_id for action {action.id}")
    return action.integration_id


def extract_notification_models_by_activity(
    activity_id: int,
) -> tuple[Activity, Group, Project, Organization]:
    try:
        activity = Activity.objects.get(id=activity_id)
    except Activity.DoesNotExist:
        raise ValueError(f"Activity not found: {activity_id}")
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

    return activity, group, project, organization
