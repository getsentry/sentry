from __future__ import annotations

import dataclasses
from collections.abc import Mapping

import orjson
from cryptography.exceptions import InvalidSignature
from rest_framework import status
from rest_framework.request import Request

from sentry import options
from sentry.constants import ObjectStatus
from sentry.identity.services.identity import RpcIdentityProvider
from sentry.identity.services.identity.model import RpcIdentity
from sentry.identity.services.identity.service import identity_service
from sentry.integrations.discord.client import DISCORD_BASE_URL
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service

from ..utils import logger, verify_signature


@dataclasses.dataclass(frozen=True)
class DiscordRequestError(Exception):
    """
    Something was invalid about the request from Discord.
    Includes the status the endpoint should return, based on the error.
    """

    status: int


class DiscordRequestTypes:
    PING = 1
    COMMAND = 2
    MESSAGE_COMPONENT = 3
    MODAL_SUBMIT = 5


class DiscordMessageComponentTypes:
    ACTION_ROW = 1
    BUTTON = 2
    SELECT = 3
    TEXT_INPUT = 4


class DiscordRequest:
    """
    A Request from Discord to our interactions endpoint.

    Handles request verification and data access.

    Raises DiscordRequestError whenever something goes wrong, including the
    appropriate response code that the endpoint should respond with.
    """

    def __init__(self, request: Request):
        self.request = request
        self._body = self.request.body.decode()
        self._data: Mapping[str, object] = orjson.loads(self.request.body)
        self._integration: RpcIntegration | None = None
        self._provider: RpcIdentityProvider | None = None
        self._identity: RpcIdentity | None = None
        self._user: RpcUser | None = None
        self.user: RpcUser | None = None

    @property
    def integration(self) -> RpcIntegration | None:
        return self._integration

    @property
    def data(self) -> Mapping[str, object]:
        """This is the data object nested within request.data"""
        data = self._data.get("data")
        if isinstance(data, dict):
            return data
        else:
            return {}

    @property
    def guild_id(self) -> str | None:
        guild_id = self._data.get("guild_id")
        return str(guild_id) if guild_id else None

    @property
    def channel_id(self) -> str | None:
        channel_id = self._data.get("channel_id")
        return str(channel_id) if channel_id else None

    @property
    def user_id(self) -> str | None:
        try:
            # 'member' object is sent when the interaction is invoked in a guild, and 'user' object is sent when
            # invoked in a DM.
            # See: https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object
            user_source = self._data.get("member", None)
            if user_source is None:
                user_source = self._data
            return user_source["user"]["id"]  # type: ignore[index]
        except (AttributeError, TypeError, KeyError):
            return None

    @property
    def logging_data(self) -> Mapping[str, str | int]:
        # TODO: come back to this later and see what additional metadata makes sense to include here
        data: dict[str, str | int | None] = {
            "discord_guild_id": self.guild_id,
            "discord_channel_id": self.channel_id,
        }
        if self.integration:
            data["integration_id"] = self.integration.id
        if self.user_id:
            data["discord_user_id"] = self.user_id
        if self.user:
            data["user"] = self.user.email
        if self._identity:
            data["has_identity"] = True
        if self.has_identity():
            data["identity"] = self.get_identity_str()
        if self.is_command():
            data["command"] = self.get_command_name()
        if self.is_message_component():
            data["component_custom_id"] = self.get_component_custom_id()

        return {k: v for k, v in data.items() if v}

    @property
    def response_url(self) -> str | None:
        """Used for async responses in DiscordRequestParser"""
        application_id = self._data.get("application_id")
        token = self._data.get("token")
        if not token or not application_id:
            return None
        return f"{DISCORD_BASE_URL}/webhooks/{application_id}/{token}"

    def _get_context(self):
        context = integration_service.get_integration_identity_context(
            integration_provider="discord",
            integration_external_id=self.guild_id,
            identity_external_id=self.user_id,
            identity_provider_external_id=self.guild_id,
        )
        if not context:
            return
        self._integration = context.integration
        self._provider = context.identity_provider
        self._identity = context.identity
        self._user = context.user

    def validate(self) -> None:
        self._log_request()
        self._get_context()
        self.authorize()
        self.validate_integration()
        self._validate_identity()

    def authorize(self) -> None:
        public_key: str = options.get("discord.public-key")
        signature: str | None = self.request.META.get("HTTP_X_SIGNATURE_ED25519")
        timestamp: str | None = self.request.META.get("HTTP_X_SIGNATURE_TIMESTAMP")
        body: str = self._body
        if not signature or not timestamp:
            self._info(
                "discord.authorize.auth.missing.data",
                {**self.logging_data, "signature": signature, "timestamp": timestamp},
            )
            raise DiscordRequestError(status=status.HTTP_401_UNAUTHORIZED)
        try:
            verify_signature(public_key, signature, timestamp, body)
        except InvalidSignature:
            self._info(
                "discord.authorize.auth.invalid.signature",
                {**self.logging_data, "signature": signature, "timestamp": timestamp, "body": body},
            )
            raise DiscordRequestError(status=status.HTTP_401_UNAUTHORIZED)
        except ValueError:
            self._info(
                "discord.authorize.auth.value.error",
                {**self.logging_data, "signature": signature, "timestamp": timestamp, "body": body},
            )
            raise DiscordRequestError(status=status.HTTP_401_UNAUTHORIZED)

    def _validate_identity(self) -> None:
        self.user = self.get_identity_user()
        if not self.user:
            self._info("discord.validate.identity.no.user")

    def get_identity_user(self) -> RpcUser | None:
        if self._user:
            return self._user
        identity = self.get_identity()
        if not identity:
            return None
        return user_service.get_user(identity.user_id)

    def get_identity(self) -> RpcIdentity | None:
        if not self._provider:
            self._provider = identity_service.get_provider(
                provider_type="discord", provider_ext_id=self.guild_id
            )
            if not self._provider:
                self._info("discord.validate.identity.no.provider")

        if not self._identity and self._provider is not None:
            self._info("discord.validate.identity.no.identity")
            self._identity = (
                identity_service.get_identity(
                    filter={"provider_id": self._provider.id, "identity_ext_id": self.user_id}
                )
                if self._provider
                else None
            )
            if not self._identity:
                self._info("discord.validate.identity.get.identity.fail")
        self._info("discord.validate.identity")

        return self._identity

    def get_identity_str(self) -> str | None:
        if self.user is None:
            return None

        return self.user.email if self.user else None

    def validate_integration(self) -> None:
        if not self._integration:
            self._integration = integration_service.get_integration(
                provider="discord", external_id=self.guild_id, status=ObjectStatus.ACTIVE
            )
        self._info("discord.validate.integration")

    def has_identity(self) -> bool:
        return self.user is not None

    def _log_request(self) -> None:
        self._info("discord.request")

    def _info(self, key: str, extra=None) -> None:
        if not extra:
            extra = {**self.logging_data}
        logger.info(key, extra=extra)

    def _error(self, key: str) -> None:
        logger.error(key, extra={**self.logging_data})

    def is_ping(self) -> bool:
        return self._data.get("type", 0) == DiscordRequestTypes.PING

    def is_command(self) -> bool:
        return self._data.get("type", 0) == DiscordRequestTypes.COMMAND

    def is_message_component(self) -> bool:
        return self._data.get("type", 0) == DiscordRequestTypes.MESSAGE_COMPONENT

    def get_command_name(self) -> str:
        if not self.is_command():
            return ""
        return str(self.data.get("name", ""))

    def get_component_custom_id(self) -> str:
        if not self.is_message_component():
            return ""
        return str(self.data.get("custom_id", ""))

    def is_select_component(self) -> bool:
        return self.data.get("component_type", None) == DiscordMessageComponentTypes.SELECT

    def get_selected_options(self) -> list[str]:
        if not self.is_select_component():
            logger.info("discord.interaction.component.not.is_select_component")
            return []
        values = self.data.get("values", [])
        logger.info(
            "discord.interaction.component.get_selected_options",
            extra={"data": self.data, "values": values},
        )
        return values  # type: ignore[return-value]
