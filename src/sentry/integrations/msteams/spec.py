from sentry import analytics
from sentry.integrations.base import IntegrationProvider
from sentry.integrations.messaging.spec import (
    MessagingIdentityLinkViewSet,
    MessagingIntegrationSpec,
)
from sentry.integrations.types import IntegrationProviderSlug
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
        from sentry.integrations.msteams.integration import MsTeamsIntegrationProvider

        return MsTeamsIntegrationProvider

    @property
    def identity_view_set(self) -> MessagingIdentityLinkViewSet:
        from sentry.integrations.msteams.link_identity import MsTeamsLinkIdentityView
        from sentry.integrations.msteams.unlink_identity import MsTeamsUnlinkIdentityView

        return MessagingIdentityLinkViewSet(
            link_personal_identity=MsTeamsLinkIdentityView,
            unlink_personal_identity=MsTeamsUnlinkIdentityView,
        )

    @property
    def notify_service_action(self) -> type[IntegrationEventAction] | None:
        from sentry.integrations.msteams.actions.notification import MsTeamsNotifyServiceAction

        return MsTeamsNotifyServiceAction

    @property
    def notification_sent(self) -> type[analytics.Event] | None:
        from sentry.integrations.msteams.analytics import MSTeamsIntegrationNotificationSent

        return MSTeamsIntegrationNotificationSent
