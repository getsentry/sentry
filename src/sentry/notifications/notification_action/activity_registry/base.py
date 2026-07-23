import logging

from sentry.models.activity import Activity
from sentry.notifications.notification_action.registry import activity_handler_registry
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.templates.activity.base import (
    ACTIVITY_TYPE_TO_SOURCE,
    ActivityNotificationData,
    build_activity_notification_data,
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


def send_activity_notification(
    invocation: ActionInvocation,
    activity: Activity,
    target: NotificationTarget,
) -> None:
    data = build_activity_notification_data(activity, workflow_id=invocation.workflow_id)
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
