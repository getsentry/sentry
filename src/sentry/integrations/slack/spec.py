from sentry import analytics
from sentry.integrations.base import IntegrationProvider
from sentry.integrations.messaging import MessagingIdentityLinkViewSet, MessagingIntegrationSpec
from sentry.integrations.slack.actions.notification import SlackNotifyServiceAction
from sentry.integrations.slack.analytics import SlackIntegrationNotificationSent
from sentry.integrations.slack.integration import SlackIntegrationProvider
from sentry.integrations.slack.views.link_identity import SlackLinkIdentityView
from sentry.integrations.slack.views.link_team import SlackLinkTeamView
from sentry.integrations.slack.views.unlink_identity import SlackUnlinkIdentityView
from sentry.integrations.slack.views.unlink_team import SlackUnlinkTeamView
from sentry.rules.actions import IntegrationEventAction


class SlackMessagingSpec(MessagingIntegrationSpec):
    @property
    def integration_provider(self) -> type[IntegrationProvider]:
        return SlackIntegrationProvider

    @property
    def identity_view_set(self) -> MessagingIdentityLinkViewSet:
        return MessagingIdentityLinkViewSet(
            link_personal_identity=SlackLinkIdentityView,
            unlink_personal_identity=SlackUnlinkIdentityView,
            link_team_identity=SlackLinkTeamView,
            unlink_team_identity=SlackUnlinkTeamView,
        )

    @property
    def notify_service_action(self) -> type[IntegrationEventAction] | None:
        return SlackNotifyServiceAction

    @property
    def notification_sent(self) -> type[analytics.Event] | None:
        return SlackIntegrationNotificationSent
