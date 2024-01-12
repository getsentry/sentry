from __future__ import annotations

from collections.abc import Mapping, Sequence
from enum import Enum
from typing import Any
from urllib.parse import urlencode

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
from sentry.models.integrations.integration import Integration
from sentry.pipeline.views.base import PipelineView
from sentry.services.hybrid_cloud.organization.model import RpcOrganizationSummary
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.utils.http import absolute_uri

from .utils import logger

DESCRIPTION = """Discord’s your place to collaborate, share, and just talk about your day – or
commiserate about app errors. Connect Sentry to your Discord server and get
[alerts](https://docs.sentry.io/product/alerts/alert-types/) in a channel of your choice or via
direct message when sh%t hits the fan."""

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

COMMANDS: list[object] = [
    {
        "name": "link",
        "description": "Link your Discord account to your Sentry account to perform actions on Sentry notifications.",
        "type": 1,
    },
    {
        "name": "unlink",
        "description": "Unlink your Discord account from your Sentry account.",
        "type": 1,
    },
    {
        "name": "help",
        "description": "View a list of Sentry bot commands and what they do.",
        "type": 1,
    },
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
        return DiscordClient()

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


class DiscordPermissions(Enum):
    # https://discord.com/developers/docs/topics/permissions#permissions
    VIEW_CHANNEL = 1 << 10
    SEND_MESSAGES = 1 << 11
    SEND_TTS_MESSAGES = 1 << 12
    EMBED_LINKS = 1 << 14
    ATTACH_FILES = 1 << 15
    MANAGE_THREADS = 1 << 34
    CREATE_PUBLIC_THREADS = 1 << 35
    CREATE_PRIVATE_THREADS = 1 << 36
    SEND_MESSAGES_IN_THREADS = 1 << 38


class DiscordIntegrationProvider(IntegrationProvider):
    key = "discord"
    name = "Discord"
    metadata = metadata
    integration_cls = DiscordIntegration
    features = frozenset([IntegrationFeatures.CHAT_UNFURL, IntegrationFeatures.ALERT_RULE])

    # https://discord.com/developers/docs/topics/oauth2#shared-resources-oauth2-scopes
    oauth_scopes = frozenset(["applications.commands", "bot", "identify"])

    bot_permissions = (
        DiscordPermissions.VIEW_CHANNEL.value
        | DiscordPermissions.SEND_MESSAGES.value
        | DiscordPermissions.EMBED_LINKS.value
        | DiscordPermissions.CREATE_PUBLIC_THREADS.value
        | DiscordPermissions.CREATE_PRIVATE_THREADS.value
        | DiscordPermissions.SEND_MESSAGES_IN_THREADS.value
    )

    setup_dialog_config = {"width": 600, "height": 900}

    def __init__(self) -> None:
        self.application_id = options.get("discord.application-id")
        self.public_key = options.get("discord.public-key")
        self.bot_token = options.get("discord.bot-token")
        self.client_secret = options.get("discord.client-secret")
        self.client = DiscordClient()
        self.setup_url = absolute_uri("extensions/discord/setup/")
        self.configure_url = absolute_uri("extensions/discord/configure/")
        super().__init__()

    def get_pipeline_views(self) -> Sequence[PipelineView]:
        return [DiscordInstallPipeline(self.get_params_for_oauth())]

    def build_integration(self, state: Mapping[str, object]) -> Mapping[str, object]:
        guild_id = str(state.get("guild_id"))
        try:
            guild_name = self.client.get_guild_name(guild_id=guild_id)
        except (ApiError, AttributeError):
            guild_name = guild_id

        discord_config = state.get("discord", {})
        if isinstance(discord_config, dict):
            use_configure = discord_config.get("use_configure") == "1"
        else:
            use_configure = False
        url = self.configure_url if use_configure else self.setup_url
        discord_user_id = self._get_discord_user_id(str(state.get("code")), url)

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

    def _has_application_commands(self) -> bool:
        try:
            return self.client.has_application_commands()
        except ApiError as e:
            logger.error(
                "discord.fail.setup.get_application_commands",
                extra={
                    "status": e.code,
                    "error": str(e),
                    "application_id": self.application_id,
                },
            )
            raise ApiError(str(e))

    def post_install(
        self,
        integration: Integration,
        organization: RpcOrganizationSummary,
        extra: Any | None = None,
    ) -> None:
        if self._credentials_exist() and not self._has_application_commands():
            try:
                for command in COMMANDS:
                    self.client.set_application_command(command)
            except ApiError as e:
                logger.error(
                    "discord.fail.setup.set_application_command",
                    extra={
                        "status": e.code,
                        "error": str(e),
                        "application_id": self.application_id,
                    },
                )
                raise ApiError(str(e))

    def _get_discord_user_id(self, auth_code: str, url: str) -> str:
        """
        Helper function for completing the oauth2 flow and grabbing the
        installing user's Discord user id so we can link their identities.

        We don't keep the granted token beyond this function because we don't
        need it.

        If something goes wrong with this we will throw an error because we
        need an initial identity to configure the identity provider for this
        integration.

        """
        form_data = f"client_id={self.application_id}&client_secret={self.client_secret}&grant_type=authorization_code&code={auth_code}&redirect_uri={url}"
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
            logger.error("discord.install.failed_to_complete_oauth2_flow", extra={"error": str(e)})
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

    def get_params_for_oauth(
        self,
    ):
        return {
            "client_id": self.application_id,
            "permissions": self.bot_permissions,
            "scope": " ".join(self.oauth_scopes),
            "response_type": "code",
        }

    def _credentials_exist(self) -> bool:
        has_credentials = all(
            (self.application_id, self.public_key, self.bot_token, self.client_secret)
        )
        if not has_credentials:
            logger.error(
                "discord.install.fail.credentials_exist",
                extra={
                    "application_id": self.application_id,
                    "has_public_key": bool(self.public_key),
                    "has_bot_token": bool(self.bot_token),
                    "has_client_secret": bool(self.client_secret),
                },
            )
        return has_credentials


class DiscordInstallPipeline(PipelineView):
    def __init__(self, params):
        self.params = params
        super().__init__()

    def dispatch(self, request, pipeline):
        if "guild_id" not in request.GET or "code" not in request.GET:
            state = pipeline.fetch_state(key="discord") or {}
            redirect_uri = (
                absolute_uri("extensions/discord/configure/")
                if state.get("use_configure") == "1"
                else absolute_uri("extensions/discord/setup/")
            )
            params = urlencode(
                {
                    "redirect_uri": redirect_uri,
                    **self.params,
                }
            )
            redirect_uri = f"https://discord.com/api/oauth2/authorize?{params}"
            return self.redirect(redirect_uri)

        pipeline.bind_state("guild_id", request.GET["guild_id"])
        pipeline.bind_state("code", request.GET["code"])
        return pipeline.next_step()
