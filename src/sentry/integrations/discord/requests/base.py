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
        self._data: Mapping[str, object] = {}
        self._identity: RpcIdentity | None = None
        self.user: RpcUser | None = None

    @property
    def integration(self) -> RpcIntegration | None:
        return self._integration

    @property
    def data(self) -> Mapping[str, object]:
        if not self._data:
            self._validate_data()
        return self._data

    @property
    def guild_id(self) -> str | None:
        guild_id = self.data.get("guild_id")
        return str(guild_id) if guild_id else None

    @property
    def channel_id(self) -> str | None:
        channel_id = self.data.get("channel_id")
        return str(channel_id) if channel_id else None

    @property
    def user_id(self) -> str | None:
        try:
            return self.data.get("member")["user"]["id"]  # type: ignore
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

        return {k: v for k, v in data.items() if v}

    def validate(self) -> None:
        self._validate_data()
        self._log_request()
        self.authorize()
        self.validate_integration()
        self._validate_identity()

    def authorize(self) -> None:
        public_key: str = options.get("discord.public-key")
        signature: str | None = self.request.META.get("HTTP_X_SIGNATURE_ED25519")
        timestamp: str | None = self.request.META.get("HTTP_X_SIGNATURE_TIMESTAMP")
        body: str = self.request.body.decode("utf-8")

        if signature and timestamp and verify_signature(public_key, signature, timestamp + body):
            return

        raise DiscordRequestError(status=status.HTTP_401_UNAUTHORIZED)

    def _validate_data(self) -> None:
        try:
            self._data = self.request.data
        except (ValueError, TypeError):
            raise DiscordRequestError(status=status.HTTP_400_BAD_REQUEST)

    def _validate_identity(self) -> None:
        self.user = self.get_identity_user()

    def get_identity_user(self) -> RpcUser | None:
        identity = self.get_identity()
        if not identity:
            return None
        return user_service.get_user(identity.user_id)

    def get_identity(self) -> RpcIdentity | None:
        if not self._identity:
            provider = identity_service.get_provider(
                provider_type="discord", provider_ext_id=self.guild_id
            )
            self._identity = (
                identity_service.get_identity(
                    filter={"provider_id": provider.id, "identity_ext_id": self.user_id}
                )
                if provider
                else None
            )
        return self._identity

    def get_identity_str(self) -> str | None:
        return self.user.email if self.user else None

    def validate_integration(self) -> None:
        self._integration = integration_service.get_integration(
            provider="discord", external_id=self.guild_id
        )

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

    def get_command_name(self) -> str:
        if not self.is_command():
            return ""
        return self._data.get("data")["name"]  # type: ignore
