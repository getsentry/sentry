from sentry.integrations.discord.spec import DiscordMessagingSpec
from sentry.integrations.messaging.metrics import (
    MessagingInteractionEvent,
    MessagingInteractionType,
)
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


@activity_handler_registry.register(Action.Type.DISCORD)
class DiscordActivityHandler(ActivityHandler):
    compatible_activity_types = NOTIFICATION_PLATFORM_COMPATIBLE_ACTIVITIES

    @classmethod
    def invoke_action(cls, invocation: ActionInvocation, activity: Activity) -> None:
        with MessagingInteractionEvent(
            interaction_type=MessagingInteractionType.SEND_ACTIVITY_ALERT_NOTIFICATION,
            spec=DiscordMessagingSpec(),
        ).capture():
            target = IntegrationNotificationTarget(
                provider_key=NotificationProviderKey.DISCORD,
                resource_type=NotificationTargetResourceType.CHANNEL,
                resource_id=require_config(invocation.action, "target_identifier"),
                integration_id=require_integration_id(invocation.action),
                organization_id=invocation.detector.project.organization.id,
            )
            send_activity_notification(invocation, activity, target)
