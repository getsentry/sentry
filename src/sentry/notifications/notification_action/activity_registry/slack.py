from sentry.integrations.messaging.metrics import (
    MessagingInteractionEvent,
    MessagingInteractionType,
)
from sentry.integrations.messaging.spec import MessagingIntegrationSpec
from sentry.integrations.slack.spec import SlackMessagingSpec
from sentry.integrations.slack.staging.spec import SlackStagingMessagingSpec
from sentry.integrations.slack.utils.channel import is_input_a_user_id
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


@activity_handler_registry.register(Action.Type.SLACK_STAGING)
@activity_handler_registry.register(Action.Type.SLACK)
class SlackActivityHandler(ActivityHandler):
    compatible_activity_types = NOTIFICATION_PLATFORM_COMPATIBLE_ACTIVITIES

    @classmethod
    def invoke_action(cls, invocation: ActionInvocation, activity: Activity) -> None:
        messaging_spec: MessagingIntegrationSpec
        if invocation.action.type == Action.Type.SLACK_STAGING:
            messaging_spec = SlackStagingMessagingSpec()
            provider_key = NotificationProviderKey.SLACK_STAGING
        else:
            messaging_spec = SlackMessagingSpec()
            provider_key = NotificationProviderKey.SLACK
        with MessagingInteractionEvent(
            interaction_type=MessagingInteractionType.SEND_ACTIVITY_ALERT_NOTIFICATION,
            spec=messaging_spec,
        ).capture():
            resource_id = require_config(invocation.action, "target_identifier")
            resource_type = (
                NotificationTargetResourceType.DIRECT_MESSAGE
                if is_input_a_user_id(input_id=resource_id)
                else NotificationTargetResourceType.CHANNEL
            )
            target = IntegrationNotificationTarget(
                provider_key=provider_key,
                resource_type=resource_type,
                resource_id=resource_id,
                integration_id=require_integration_id(invocation.action),
                organization_id=invocation.detector.project.organization.id,
            )
            send_activity_notification(invocation, activity, target)
