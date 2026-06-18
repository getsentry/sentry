import logging

from sentry.models.activity import Activity
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.templates.workflow_engine import (
    ACTIVITY_TYPE_TO_SOURCE,
    WorkflowEngineActivityAction,
)
from sentry.notifications.platform.types import NotificationTarget
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation

logger = logging.getLogger(__name__)


NOTIFICATION_PLATFORM_COMPATIBLE_ACTIVITIES = [
    ActivityType(value) for value in ACTIVITY_TYPE_TO_SOURCE
]


def build_activity_data(
    invocation: ActionInvocation, activity: Activity
) -> WorkflowEngineActivityAction:
    detector = invocation.detector

    source = ACTIVITY_TYPE_TO_SOURCE.get(activity.type)
    if source is None:
        raise ValueError(f"No notification source for activity type: {activity.type}")

    return WorkflowEngineActivityAction(
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
    NotificationService[WorkflowEngineActivityAction](data=data).notify_sync(targets=[target])


def require_config(action: Action, key: str) -> str:
    value = action.config.get(key)
    if not value:
        raise ValueError(f"No {key} for action {action.id}")
    return value


def require_integration_id(action: Action) -> int:
    if action.integration_id is None:
        raise ValueError(f"No integration_id for action {action.id}")
    return action.integration_id
