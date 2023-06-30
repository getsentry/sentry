from __future__ import annotations

from collections.abc import Mapping, Sequence

from django.utils.translation import gettext_lazy as _

from sentry import options
from sentry.integrations import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.discord.client import DiscordClient
from sentry.pipeline.views.base import PipelineView
from sentry.utils.http import absolute_uri

DESCRIPTION = "Discord’s your place to collaborate, share, and just talk about your day – or commiserate about app errors. Connect Sentry to your Discord server and get [alerts](https://docs.sentry.io/product/alerts/alert-types/) in a channel of your choice or via direct message when sh%t hits the fan."

FEATURES = [
    FeatureDescription(
        "Assign, ignore, and resolve issues by interacting with chat messages.",
        IntegrationFeatures.CHAT_UNFURL,
    ),
    # We'll add IntegrationFeatures.ALERT_RULE here in milestone 2
]

metadata = IntegrationMetadata(
    description=_(DESCRIPTION.strip()),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Discord%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/discord",
    aspects={},
)


class DiscordIntegration(IntegrationInstallation):
    pass


class DiscordIntegrationProvider(IntegrationProvider):
    key = "discord"
    name = "Discord"
    metadata = metadata
    integration_cls = DiscordIntegration
    features = frozenset([IntegrationFeatures.CHAT_UNFURL])
    requires_feature_flag = True  # remove this when we remove the discord feature flag

    # https://discord.com/developers/docs/topics/oauth2#shared-resources-oauth2-scopes
    oauth_scopes = frozenset(["applications.commands", "bot"])

    # Visit the bot tab of your app in the Discord developer portal for a tool to generate this
    bot_permissions = 2048

    setup_dialog_config = {"width": 600, "height": 900}

    def get_pipeline_views(self) -> Sequence[PipelineView]:
        return [DiscordInstallPipeline(self.get_bot_install_url())]

    def build_integration(self, state: Mapping[str, object]) -> Mapping[str, object]:
        guild_id = str(state.get("guild_id"))
        guild_name = DiscordClient()._get_guild_name(guild_id)
        return {
            "name": guild_name,
            "external_id": guild_id,
        }

    def get_bot_install_url(self):
        application_id = options.get("discord.application-id")
        setup_url = absolute_uri("extensions/discord/setup/")

        return f"https://discord.com/api/oauth2/authorize?client_id={application_id}&permissions={self.bot_permissions}&redirect_uri={setup_url}&response_type=code&scope={' '.join(self.oauth_scopes)}"


class DiscordInstallPipeline(PipelineView):
    def __init__(self, install_url: str):
        self.install_url = install_url
        super().__init__()

    def dispatch(self, request, pipeline):
        if "guild_id" in request.GET:
            pipeline.bind_state("guild_id", request.GET["guild_id"])
            return pipeline.next_step()

        return self.redirect(self.install_url)
