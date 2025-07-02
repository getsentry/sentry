from sentry import analytics
from sentry.incidents.endpoints.serializers.alert_rule import AlertRuleSerializerResponse
from sentry.incidents.endpoints.serializers.incident import DetailedIncidentSerializerResponse
from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    NotificationContext,
    OpenPeriodContext,
)
from sentry.integrations.base import IntegrationProvider
from sentry.integrations.messaging.spec import (
    MessagingIdentityLinkViewSet,
    MessagingIntegrationSpec,
)
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.notifications.models.notificationaction import ActionService
from sentry.rules.actions import IntegrationEventAction


class MsTeamsMessagingSpec(MessagingIntegrationSpec):
    @property
    def provider_slug(self) -> str:
        return IntegrationProviderSlug.MSTEAMS.value

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
        organization: Organization,
        alert_context: AlertContext,
        notification_context: NotificationContext,
        metric_issue_context: MetricIssueContext,
        open_period_context: OpenPeriodContext,
        alert_rule_serialized_response: AlertRuleSerializerResponse,
        incident_serialized_response: DetailedIncidentSerializerResponse,
        notification_uuid: str | None = None,
    ) -> bool:
        from sentry.integrations.msteams.utils import send_incident_alert_notification

        return send_incident_alert_notification(
            organization=organization,
            alert_context=alert_context,
            notification_context=notification_context,
            metric_issue_context=metric_issue_context,
            open_period_context=open_period_context,
            alert_rule_serialized_response=alert_rule_serialized_response,
            incident_serialized_response=incident_serialized_response,
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
