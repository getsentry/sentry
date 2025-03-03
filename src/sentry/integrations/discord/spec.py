from sentry import analytics
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.incidents.models.incident import Incident, IncidentStatus
from sentry.integrations.base import IntegrationProvider
from sentry.integrations.messaging.spec import (
    MessagingIdentityLinkViewSet,
    MessagingIntegrationSpec,
)
from sentry.notifications.models.notificationaction import ActionService
from sentry.rules.actions import IntegrationEventAction


class DiscordMessagingSpec(MessagingIntegrationSpec):
    @property
    def provider_slug(self) -> str:
        return "discord"

    @property
    def action_service(self) -> ActionService:
        return ActionService.DISCORD

    @property
    def integration_provider(self) -> type[IntegrationProvider]:
        from sentry.integrations.discord.integration import DiscordIntegrationProvider

        return DiscordIntegrationProvider

    @property
    def identity_view_set(self) -> MessagingIdentityLinkViewSet:
        from sentry.integrations.discord.views.link_identity import DiscordLinkIdentityView
        from sentry.integrations.discord.views.unlink_identity import DiscordUnlinkIdentityView

        return MessagingIdentityLinkViewSet(
            link_personal_identity=DiscordLinkIdentityView,
            unlink_personal_identity=DiscordUnlinkIdentityView,
        )

    def send_incident_alert_notification(
        self,
        action: AlertRuleTriggerAction,
        incident: Incident,
        metric_value: float,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ) -> bool:
        from sentry.integrations.discord.actions.metric_alert import (
            send_incident_alert_notification,
        )

        return send_incident_alert_notification(
            action, incident, metric_value, new_status, notification_uuid
        )

    @property
    def notify_service_action(self) -> type[IntegrationEventAction] | None:
        from sentry.integrations.discord.actions.issue_alert.notification import (
            DiscordNotifyServiceAction,
        )

        return DiscordNotifyServiceAction

    @property
    def notification_sent(self) -> type[analytics.Event] | None:
        from sentry.integrations.discord.analytics import DiscordIntegrationNotificationSent

        return DiscordIntegrationNotificationSent
