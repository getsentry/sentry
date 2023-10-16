from __future__ import annotations

import dataclasses
from collections.abc import Mapping

from rest_framework import status
from rest_framework.request import Request

from sentry import options
from sentry.services.hybrid_cloud.identity.model import RpcIdentity
from sentry.services.hybrid_cloud.identity.service import identity_service
from sentry.services.hybrid_cloud.integration import RpcIntegration, integration_service
from sentry.services.hybrid_cloud.user.model import RpcUser
from sentry.services.hybrid_cloud.user.service import user_service

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
        self._integration: RpcIntegration | None = None
        self._data: Mapping[str, object] = self.request.data
        self._identity: RpcIdentity | None = None
        self.user: RpcUser | None = None

    @property
    def integration(self) -> RpcIntegration | None:
        return self._integration

    @property
    def data(self) -> Mapping[str, object]:
        """This is the data object nested within request.data"""
        return self._data.get("data") or {}  # type: ignore

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
            return self._data.get("member")["user"]["id"]  # type: ignore
        except (AttributeError, TypeError):
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

    def validate(self) -> None:
        self._log_request()
        self.authorize()
        self.validate_integration()
        self._validate_identity()

    def authorize(self) -> None:
        public_key: str = options.get("discord.public-key")
        signature: str | None = self.request.META.get("HTTP_X_SIGNATURE_ED25519")
        timestamp: str | None = self.request.META.get("HTTP_X_SIGNATURE_TIMESTAMP")
        body: str = self.request.body.decode("utf-8")
        self._info("discord.authorize.auth")

        if signature and timestamp and verify_signature(public_key, signature, timestamp + body):
            return
        else:
            self._info("discord.authorize.unauthorized")

        raise DiscordRequestError(status=status.HTTP_401_UNAUTHORIZED)

    def _validate_identity(self) -> None:
        self.user = self.get_identity_user()
        if not self.user:
            self._info("discord.validate.identity.no.user")

    def get_identity_user(self) -> RpcUser | None:
        identity = self.get_identity()
        if not identity:
            return None
        return user_service.get_user(identity.user_id)

    def get_identity(self) -> RpcIdentity | None:
        if not self._identity:
            self._info("discord.validate.identity.no.identity")
            provider = identity_service.get_provider(
                provider_type="discord", provider_ext_id=self.guild_id
            )
            if not provider:
                self._info("discord.validate.identity.no.provider")
            self._identity = (
                identity_service.get_identity(
                    filter={"provider_id": provider.id, "identity_ext_id": self.user_id}
                )
                if provider
                else None
            )
            if not self._identity:
                self._info("discord.validate.identity.get.identity.fail")
        self._info("discord.validate.identity")

        return self._identity

    def get_identity_str(self) -> str | None:
        return self.user.email if self.user else None

    def validate_integration(self) -> None:
        self._integration = integration_service.get_integration(
            provider="discord", external_id=self.guild_id
        )
        self._info("discord.validate.integration")

    def has_identity(self) -> bool:
        return self.user is not None

    def _log_request(self) -> None:
        self._info("discord.request")

    def _info(self, key: str) -> None:
        logger.info(key, extra={**self.logging_data})

    def _error(self, key: str) -> None:
        logger.error(key, extra={**self.logging_data})

    def is_ping(self) -> bool:
        return self._data.get("type", 0) == DiscordRequestTypes.PING

    def is_command(self) -> bool:
        return self._data.get("type", 0) == DiscordRequestTypes.COMMAND

    def is_message_component(self) -> bool:
        return self._data.get("type", 0) == DiscordRequestTypes.MESSAGE_COMPONENT

    def is_modal_submit(self) -> bool:
        return self._data.get("type", 0) == DiscordRequestTypes.MODAL_SUBMIT

    def get_command_name(self) -> str:
        if not self.is_command():
            return ""
        return self.data["name"]  # type: ignore

    def get_component_custom_id(self) -> str:
        if not self.is_message_component():
            return ""
        return self.data["custom_id"]  # type: ignore

    def is_select_component(self) -> bool:
        return self.data["component_type"] == DiscordMessageComponentTypes.SELECT

    def get_selected_options(self) -> list[str]:
        if not self.is_select_component():
            logger.info("discord.interaction.component.not.is_select_component")
            return []
        logger.info(
            "discord.interaction.component.get_selected_options",
            extra={"data": self.data, "values": self.data["values"]},
        )
        return self.data["values"]  # type: ignore
