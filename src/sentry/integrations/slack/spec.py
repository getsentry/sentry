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


class SlackMessagingSpec(MessagingIntegrationSpec):
    @property
    def provider_slug(self) -> str:
        return "slack"

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
        action: AlertRuleTriggerAction,
        incident: Incident,
        metric_value: float,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ) -> bool:

        from sentry.integrations.slack.utils.notifications import send_incident_alert_notification

        return send_incident_alert_notification(
            action, incident, metric_value, new_status, notification_uuid
        )

    @property
    def notify_service_action(self) -> type[IntegrationEventAction] | None:
        from sentry.integrations.slack.actions.notification import SlackNotifyServiceAction

        return SlackNotifyServiceAction

    @property
    def notification_sent(self) -> type[analytics.Event] | None:
        from sentry.integrations.slack.analytics import SlackIntegrationNotificationSent

        return SlackIntegrationNotificationSent
