from sentry.models.activity import Activity
from sentry.notifications.notification_action.activity_registry.base import (
    NOTIFICATION_PLATFORM_COMPATIBLE_ACTIVITIES,
    require_config,
    require_integration_id,
    send_activity_notification,
)
from sentry.notifications.notification_action.registry import activity_handler_registry
from sentry.notifications.notification_action.types import ActivityHandler
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation


@activity_handler_registry.register(Action.Type.MSTEAMS)
class MSTeamsActivityHandler(ActivityHandler):
    compatible_activity_types = NOTIFICATION_PLATFORM_COMPATIBLE_ACTIVITIES

    @classmethod
    def invoke_action(cls, invocation: ActionInvocation, activity: Activity) -> None:
        action = invocation.action
        target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.MSTEAMS,
            resource_type=NotificationTargetResourceType.CHANNEL,
            resource_id=require_config(action, "target_display"),
            integration_id=require_integration_id(action),
            organization_id=invocation.detector.project.organization.id,
        )
        send_activity_notification(invocation, activity, target)
