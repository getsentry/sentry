from __future__ import annotations

from collections.abc import Mapping, Sequence

import requests
from django.utils.translation import gettext_lazy as _

from sentry import options
from sentry.constants import ObjectStatus
from sentry.integrations import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.discord.client import DiscordClient
from sentry.integrations.discord.commands import DiscordCommandManager
from sentry.pipeline.views.base import PipelineView
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.shared_integrations.exceptions.base import ApiError
from sentry.utils.http import absolute_uri

from .utils import logger

DESCRIPTION = "Discord’s your place to collaborate, share, and just talk about your day – or commiserate about app errors. Connect Sentry to your Discord server and get [alerts](https://docs.sentry.io/product/alerts/alert-types/) in a channel of your choice or via direct message when sh%t hits the fan."

FEATURES = [
    FeatureDescription(
        "Assign, ignore, and resolve issues by interacting with chat messages.",
        IntegrationFeatures.CHAT_UNFURL,
    ),
    FeatureDescription(
        "Configure rule based Discord notifications to automatically be posted into a specific channel.",
        IntegrationFeatures.ALERT_RULE,
    ),
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
    def get_client(self) -> DiscordClient:
        org_integration_id = self.org_integration.id if self.org_integration else None

        return DiscordClient(
            integration_id=self.model.id,
            org_integration_id=org_integration_id,
        )

    def uninstall(self) -> None:
        # If this is the only org using this Discord server, we should remove
        # the bot from the server.
        from sentry.services.hybrid_cloud.integration import integration_service

        installations = integration_service.get_organization_integrations(
            integration_id=self.model.id,
            providers=["discord"],
        )

        # Remove any installations pending deletion
        active_installations = [
            i
            for i in installations
            if i.status not in (ObjectStatus.PENDING_DELETION, ObjectStatus.DELETION_IN_PROGRESS)
        ]

        if len(active_installations) > 1:
            return

        client = self.get_client()
        try:
            client.leave_guild(str(self.model.external_id))
        except ApiError as e:
            if e.code == 404:
                # The bot has already been removed from the guild
                return
            # The bot failed to leave the guild for some other reason, but
            # this doesn't need to interrupt the uninstall. Just means the
            # bot will persist on the server until removed manually.
            logger.error(
                "discord.uninstall.failed_to_leave_guild",
                extra={"discord_guild_id": self.model.external_id, "status": e.code},
            )
            return


class DiscordIntegrationProvider(IntegrationProvider):
    key = "discord"
    name = "Discord"
    metadata = metadata
    integration_cls = DiscordIntegration
    features = frozenset([IntegrationFeatures.CHAT_UNFURL, IntegrationFeatures.ALERT_RULE])
    requires_feature_flag = True  # remove this when we remove the discord feature flag

    # https://discord.com/developers/docs/topics/oauth2#shared-resources-oauth2-scopes
    oauth_scopes = frozenset(["applications.commands", "bot", "identify"])

    # https://discord.com/developers/docs/topics/permissions#permissions
    # View Channel + read messages in text channels (1 << 10)
    # Send Messages + create threads in forum (1 << 11)
    # Embed Links (1 << 14)
    # Create public threads (1 << 35)
    # Create private threads (1 << 36)
    # Send messages in threads (1 << 38)
    bot_permissions = 1 << 10 | 1 << 11 | 1 << 14 | 1 << 35 | 1 << 36 | 1 << 38

    setup_dialog_config = {"width": 600, "height": 900}

    def __init__(self) -> None:
        self.application_id = options.get("discord.application-id")
        self.public_key = options.get("discord.public-key")
        self.bot_token = options.get("discord.bot-token")
        self.client_secret = options.get("discord.client-secret")
        self.client = DiscordClient()
        self.setup_url = absolute_uri("extensions/discord/setup/")
        super().__init__()

    def get_pipeline_views(self) -> Sequence[PipelineView]:
        return [DiscordInstallPipeline(self._get_bot_install_url())]

    def build_integration(self, state: Mapping[str, object]) -> Mapping[str, object]:
        guild_id = str(state.get("guild_id"))
        guild_name = self._get_guild_name(guild_id)
        discord_user_id = self._get_discord_user_id(str(state.get("code")))

        return {
            "name": guild_name,
            "external_id": guild_id,
            "user_identity": {
                "type": "discord",
                "external_id": discord_user_id,
                "scopes": [],
                "data": {},
            },
        }

    def setup(self) -> None:
        if self._credentials_exist():
            DiscordCommandManager().register_commands()

    def _get_guild_name(self, guild_id: str) -> str:
        url = self.client.GUILD_URL.format(guild_id=guild_id)
        headers = {"Authorization": f"Bot {self.bot_token}"}
        try:
            response = self.client.get(url, headers=headers)
            return response["name"]  # type: ignore
        except (ApiError, AttributeError):
            return guild_id

    def _get_discord_user_id(self, auth_code: str) -> str:
        """
        Helper function for completing the oauth2 flow and grabbing the
        installing user's Discord user id so we can link their identities.

        We don't keep the granted token beyond this function because we don't
        need it.

        If something goes wrong with this we will throw an error because we
        need an initial identity to configure the identity provider for this
        integration.

        """
        form_data = f"client_id={self.application_id}&client_secret={self.client_secret}&grant_type=authorization_code&code={auth_code}&redirect_uri={self.setup_url}"
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
        }

        try:
            response = self.client.post(
                "https://discord.com/api/v10/oauth2/token",
                json=False,
                data=form_data,
                headers=headers,
            )
            token = response["access_token"]  # type: ignore

        except ApiError as e:
            logger.error("discord.install.failed_to_complete_oauth2_flow", extra={"code": e.code})
            raise IntegrationError("Failed to complete Discord OAuth2 flow.")
        except KeyError:
            logger.error("discord.install.failed_to_extract_oauth2_access_token")
            raise IntegrationError("Failed to complete Discord OAuth2 flow.")

        headers = {"Authorization": f"Bearer {token}"}
        # Can't use self.client.get because that will overwrite our header
        # with our bot's authorization
        response = requests.get(f"{self.client.base_url}/users/@me", headers=headers)
        if response.status_code == 200:
            return response.json()["id"]

        logger.error(
            "discord.install.failed_to_get_discord_user_id", extra={"code": response.status_code}
        )
        raise IntegrationError("Could not retrieve Discord user information.")

    def _get_bot_install_url(self):
        return f"https://discord.com/api/oauth2/authorize?client_id={self.application_id}&permissions={self.bot_permissions}&redirect_uri={self.setup_url}&response_type=code&scope={' '.join(self.oauth_scopes)}"

    def _credentials_exist(self) -> bool:
        return all((self.application_id, self.public_key, self.bot_token, self.client_secret))


class DiscordInstallPipeline(PipelineView):
    def __init__(self, install_url: str):
        self.install_url = install_url
        super().__init__()

    def dispatch(self, request, pipeline):
        if "guild_id" not in request.GET or "code" not in request.GET:
            return self.redirect(self.install_url)

        pipeline.bind_state("guild_id", request.GET["guild_id"])
        pipeline.bind_state("code", request.GET["code"])
        return pipeline.next_step()
