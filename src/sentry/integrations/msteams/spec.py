from sentry import analytics
from sentry.integrations.base import IntegrationProvider
from sentry.integrations.messaging import MessagingIdentityLinkViewSet, MessagingIntegrationSpec
from sentry.integrations.msteams import MsTeamsIntegrationProvider
from sentry.integrations.msteams.actions.notification import MsTeamsNotifyServiceAction
from sentry.integrations.msteams.analytics import MSTeamsIntegrationNotificationSent
from sentry.integrations.msteams.link_identity import MsTeamsLinkIdentityView
from sentry.integrations.msteams.unlink_identity import MsTeamsUnlinkIdentityView
from sentry.rules.actions import IntegrationEventAction


class MsTeamsMessagingSpec(MessagingIntegrationSpec):
    @property
    def integration_provider(self) -> type[IntegrationProvider]:
        return MsTeamsIntegrationProvider

    @property
    def identity_view_set(self) -> MessagingIdentityLinkViewSet:
        return MessagingIdentityLinkViewSet(
            link_personal_identity=MsTeamsLinkIdentityView,
            unlink_personal_identity=MsTeamsUnlinkIdentityView,
        )

    @property
    def notify_service_action(self) -> type[IntegrationEventAction] | None:
        return MsTeamsNotifyServiceAction

    @property
    def notification_sent(self) -> type[analytics.Event] | None:
        return MSTeamsIntegrationNotificationSent
