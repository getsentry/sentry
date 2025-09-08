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


class SlackMessagingSpec(MessagingIntegrationSpec):
    @property
    def provider_slug(self) -> str:
        return IntegrationProviderSlug.SLACK.value

    @property
    def action_service(self) -> ActionService:
        return ActionService.SLACK

    @property
    def integration_provider(self) -> type[IntegrationProvider]:
        from sentry.integrations.slack.integration import SlackIntegrationProvider

        return SlackIntegrationProvider

    @property
    def identity_view_set(self) -> MessagingIdentityLinkViewSet:
        from sentry.integrations.slack.views.link_identity import SlackLinkIdentityView
        from sentry.integrations.slack.views.link_team import SlackLinkTeamView
        from sentry.integrations.slack.views.unlink_identity import SlackUnlinkIdentityView
        from sentry.integrations.slack.views.unlink_team import SlackUnlinkTeamView

        return MessagingIdentityLinkViewSet(
            link_personal_identity=SlackLinkIdentityView,
            unlink_personal_identity=SlackUnlinkIdentityView,
            link_team_identity=SlackLinkTeamView,
            unlink_team_identity=SlackUnlinkTeamView,
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

        from sentry.integrations.slack.utils.notifications import send_incident_alert_notification

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
        from sentry.integrations.slack.actions.notification import SlackNotifyServiceAction

        return SlackNotifyServiceAction

    @property
    def notification_sent(self) -> type[analytics.Event] | None:
        from sentry.integrations.slack.analytics import SlackIntegrationNotificationSent

        return SlackIntegrationNotificationSent
