from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from urllib.parse import urlencode

from django.http.request import HttpRequest
from django.utils.translation import gettext_lazy as _
from rest_framework.fields import CharField

from sentry import options
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.constants import ObjectStatus
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationData,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.discord.client import DiscordClient
from sentry.integrations.discord.types import DiscordPermissions
from sentry.integrations.discord.utils.metrics import translate_discord_api_error
from sentry.integrations.models.integration import Integration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.types import IntegrationProviderSlug
from sentry.notifications.platform.discord.provider import DiscordRenderable
from sentry.notifications.platform.provider import (
    IntegrationNotificationClient,
    ProviderThreadingContext,
)
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.pipeline.types import PipelineStepResult
from sentry.pipeline.views.base import ApiPipelineSteps, PipelineView
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


class DiscordIntegration(IntegrationInstallation, IntegrationNotificationClient):
    def get_client(self) -> DiscordClient:
        return DiscordClient()

    def send_notification(
        self, target: IntegrationNotificationTarget, payload: DiscordRenderable
    ) -> None:
        client = self.get_client()
        try:
            client.send_message(channel_id=target.resource_id, message=payload)
        except ApiError as e:
            translate_discord_api_error(e)

    def send_notification_with_threading(
        self,
        target: IntegrationNotificationTarget,
        payload: DiscordRenderable,
        threading_context: ProviderThreadingContext,
    ) -> dict[str, Any]:
        raise NotImplementedError("Threading is not supported for Discord")

    def uninstall(self) -> None:
        # If this is the only org using this Discord server, we should remove
        # the bot from the server.
        from sentry.integrations.services.integration import integration_service

        installations = integration_service.get_organization_integrations(
            integration_id=self.model.id,
            providers=[IntegrationProviderSlug.DISCORD.value],
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
            logger.warning(
                "discord.uninstall.failed_to_leave_guild",
                extra={"discord_guild_id": self.model.external_id, "status": e.code},
            )
            return


class DiscordOAuthApiSerializer(CamelSnakeSerializer):
    code = CharField(required=True)
    state = CharField(required=True)
    guild_id = CharField(required=True)


class DiscordOAuthApiStep:
    """API-mode OAuth step for Discord integration setup.

    Discord's OAuth flow is unique: the authorize URL includes bot permissions,
    and the callback returns a guild_id alongside the authorization code.
    This step handles both, binding guild_id and code to pipeline state.
    """

    step_name = "oauth_login"

    def __init__(
        self,
        client_id: str,
        permissions: int,
        scopes: frozenset[str],
        redirect_url: str,
    ) -> None:
        self.client_id = client_id
        self.permissions = permissions
        self.scopes = scopes
        self.redirect_url = redirect_url

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> dict[str, str]:
        params = urlencode(
            {
                "client_id": self.client_id,
                "permissions": self.permissions,
                "scope": " ".join(self.scopes),
                "response_type": "code",
                "state": pipeline.signature,
                "redirect_uri": self.redirect_url,
            }
        )
        return {"oauthUrl": f"https://discord.com/api/oauth2/authorize?{params}"}

    def get_serializer_cls(self) -> type:
        return DiscordOAuthApiSerializer

    def handle_post(
        self,
        validated_data: dict[str, str],
        pipeline: IntegrationPipeline,
        request: HttpRequest,
    ) -> PipelineStepResult:
        if validated_data["state"] != pipeline.signature:
            return PipelineStepResult.error("An error occurred while validating your request.")

        pipeline.bind_state("guild_id", validated_data["guild_id"])
        pipeline.bind_state("code", validated_data["code"])
        return PipelineStepResult.advance()


class DiscordIntegrationProvider(IntegrationProvider):
    key = IntegrationProviderSlug.DISCORD.value
    name = "Discord"
    metadata = metadata
    integration_cls = DiscordIntegration
    features = frozenset([IntegrationFeatures.CHAT_UNFURL, IntegrationFeatures.ALERT_RULE])

    # https://discord.com/developers/docs/topics/oauth2#shared-resources-oauth2-scopes
    oauth_scopes = frozenset(["applications.commands", "bot", "identify", "guilds.members.read"])
    access_token = ""

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

    def get_pipeline_views(self) -> list[PipelineView[IntegrationPipeline]]:
        return []

    def get_pipeline_api_steps(self) -> ApiPipelineSteps[IntegrationPipeline]:
        return [
            DiscordOAuthApiStep(
                client_id=self.application_id,
                permissions=self.bot_permissions,
                scopes=self.oauth_scopes,
                redirect_url=self.setup_url,
            ),
        ]

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        guild_id = str(state.get("guild_id"))

        if not guild_id.isdigit():
            raise IntegrationError(
                "Invalid guild ID. The Discord guild ID must be entirely numeric."
            )

        try:
            guild_name = self.client.get_guild_name(guild_id=guild_id)
        except (ApiError, AttributeError):
            guild_name = guild_id

        discord_config = state.get(IntegrationProviderSlug.DISCORD.value, {})
        if isinstance(discord_config, dict):
            use_configure = discord_config.get("use_configure") == "1"
        else:
            use_configure = False
        url = self.configure_url if use_configure else self.setup_url

        auth_code = str(state.get("code"))
        if auth_code:
            discord_user_id = self._get_discord_user_id(auth_code, url)
            if not self.client.check_user_bot_installation_permission(
                access_token=self.access_token, guild_id=guild_id
            ):
                raise IntegrationError("User does not have permissions to install bot.")
        else:
            raise IntegrationError("Missing code from state.")

        return {
            "name": guild_name,
            "external_id": guild_id,
            "user_identity": {
                "type": IntegrationProviderSlug.DISCORD.value,
                "external_id": discord_user_id,
                "scopes": [],
                "data": {},
            },
        }

    def _has_application_commands(self) -> bool:
        try:
            return self.client.has_application_commands()
        except ApiError as e:
            logger.warning(
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
        organization: RpcOrganization,
        *,
        extra: dict[str, Any],
    ) -> None:
        if self._credentials_exist() and not self._has_application_commands():
            try:
                for command in COMMANDS:
                    self.client.set_application_command(command)
            except ApiError as e:
                logger.warning(
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
        try:
            self.access_token = self.client.get_access_token(auth_code, url)
        except ApiError:
            raise IntegrationError("Failed to get Discord access token from API.")
        except KeyError:
            raise IntegrationError("Failed to get Discord access token from key.")
        try:
            user_id = self.client.get_user_id(self.access_token)
        except ApiError:
            raise IntegrationError("Failed to get Discord user ID from API.")
        except KeyError:
            raise IntegrationError("Failed to get Discord user ID from key.")
        return user_id

    def _credentials_exist(self) -> bool:
        has_credentials = all(
            (self.application_id, self.public_key, self.bot_token, self.client_secret)
        )
        if not has_credentials:
            logger.warning(
                "discord.install.fail.credentials_exist",
                extra={
                    "application_id": self.application_id,
                    "has_public_key": bool(self.public_key),
                    "has_bot_token": bool(self.bot_token),
                    "has_client_secret": bool(self.client_secret),
                },
            )
        return has_credentials
