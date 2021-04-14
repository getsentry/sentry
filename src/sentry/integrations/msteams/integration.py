import logging

from django.utils.translation import ugettext_lazy as _

from sentry import options
from sentry.integrations import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.pipeline import PipelineView

from .card_builder import build_installation_confirmation_message
from .client import MsTeamsClient, get_token_data

logger = logging.getLogger("sentry.integrations.msteams")

DESCRIPTION = (
    "Microsoft Teams is a hub for teamwork in Office 365. Keep all your team's chats, meetings, files, and apps together in one place."
    "\n\nGet [alerts](https://docs.sentry.io/product/alerts-notifications/alerts/) that let you assign, ignore, and resolve issues"
    " right in your Teams channels with the Sentry integration for Microsoft Teams."
)


FEATURES = [
    FeatureDescription(
        """
        Interact with messages in the chat to assign, ignore, and resolve issues.
        """,
        IntegrationFeatures.CHAT_UNFURL,  # not acutally using unfurl but we show this as just "chat"
    ),
    FeatureDescription(
        "Configure rule based Teams alerts to automatically be posted into a specific channel or user.",
        IntegrationFeatures.ALERT_RULE,
    ),
]


INSTALL_NOTICE_TEXT = (
    "Visit the Teams Marketplace to install this integration. After adding the integration"
    " to your team, you will get a welcome message in the General channel to complete installation."
)

external_install = {
    "url": "https://teams.microsoft.com/l/app/{}".format(options.get("msteams.app-id")),
    "buttonText": _("Teams Marketplace"),
    "noticeText": _(INSTALL_NOTICE_TEXT),
}


metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug_report.md&title=Microsoft%20Teams%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/msteams",
    aspects={"externalInstall": external_install},
)


class MsTeamsIntegration(IntegrationInstallation):
    pass


class MsTeamsIntegrationProvider(IntegrationProvider):
    key = "msteams"
    name = "Microsoft Teams"
    can_add = False
    metadata = metadata
    integration_cls = MsTeamsIntegration
    features = frozenset([IntegrationFeatures.CHAT_UNFURL, IntegrationFeatures.ALERT_RULE])

    def get_pipeline_views(self):
        return [MsTeamsPipelineView()]

    def build_integration(self, state):
        data = state[self.key]
        team_id = data["team_id"]
        team_name = data["team_name"]
        service_url = data["service_url"]

        # TODO: add try/except for request errors
        token_data = get_token_data()

        integration = {
            "name": team_name,
            "external_id": team_id,
            "metadata": {
                "access_token": token_data["access_token"],
                "expires_at": token_data["expires_at"],
                "service_url": service_url,
            },
            # TODO: Use user id for external_id in user_identity
            "user_identity": {"type": "msteams", "external_id": team_id, "scopes": [], "data": {}},
        }
        return integration

    def post_install(self, integration, organization, extra=None):
        client = MsTeamsClient(integration)
        card = build_installation_confirmation_message(organization)
        conversation_id = integration.external_id
        client.send_card(conversation_id, card)


class MsTeamsPipelineView(PipelineView):
    def dispatch(self, request, pipeline):
        return pipeline.next_step()
