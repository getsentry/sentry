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

PROVIDER = "msteams"


class MsTeamsMessagingSpec(MessagingIntegrationSpec):
    @property
    def provider_slug(self) -> str:
        return PROVIDER

    @property
    def action_service(self) -> ActionService:
        return ActionService.MSTEAMS

    @property
    def integration_provider(self) -> type[IntegrationProvider]:
        from sentry.integrations.msteams import MsTeamsIntegrationProvider

        return MsTeamsIntegrationProvider

    @property
    def identity_view_set(self) -> MessagingIdentityLinkViewSet:
        from sentry.integrations.msteams.link_identity import MsTeamsLinkIdentityView
        from sentry.integrations.msteams.unlink_identity import MsTeamsUnlinkIdentityView

        return MessagingIdentityLinkViewSet(
            link_personal_identity=MsTeamsLinkIdentityView,
            unlink_personal_identity=MsTeamsUnlinkIdentityView,
        )

    def send_incident_alert_notification(
        self,
        action: AlertRuleTriggerAction,
        incident: Incident,
        metric_value: float,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ) -> bool:
        from sentry.integrations.msteams.utils import send_incident_alert_notification

        return send_incident_alert_notification(
            action=action,
            incident=incident,
            metric_value=metric_value,
            new_status=new_status,
            notification_uuid=notification_uuid,
        )

    @property
    def notify_service_action(self) -> type[IntegrationEventAction] | None:
        from sentry.integrations.msteams.actions.notification import MsTeamsNotifyServiceAction

        return MsTeamsNotifyServiceAction

    @property
    def notification_sent(self) -> type[analytics.Event] | None:
        from sentry.integrations.msteams.analytics import MSTeamsIntegrationNotificationSent

        return MSTeamsIntegrationNotificationSent
