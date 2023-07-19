from __future__ import annotations

import dataclasses
from collections.abc import Mapping

from rest_framework import status
from rest_framework.request import Request

from sentry import options
from sentry.services.hybrid_cloud.integration import RpcIntegration, integration_service

from ..utils import logger, verify_signature


@dataclasses.dataclass(frozen=True)
class DiscordRequestError(Exception):
    """
    Something was invalid about the request from Discord.
    Includes the status the endpoint should return, based on the error.
    """

    status: int


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
    def logging_data(self) -> Mapping[str, str | int]:
        # TODO: come back to this later and see what additional metadata makes sense to include here
        data: dict[str, str | int | None] = {
            "discord_guild_id": self.guild_id,
            "discord_channel_id": self.channel_id,
        }

        if self.integration:
            data["integration_id"] = self.integration.id

        return {k: v for k, v in data.items() if v}

    def validate(self) -> None:
        self._validate_data()
        self._log_request()
        self.authorize()
        self.validate_integration()

    def authorize(self) -> None:
        public_key: str = options.get("discord.public-key")
        signature: str | None = self.request.META.get("HTTP_X_SIGNATURE_ED25519")
        timestamp: str | None = self.request.META.get("HTTP_X_SIGNATURE_TIMESTAMP")
        body: str = self.request.body.decode("utf-8")

        if signature and timestamp and verify_signature(public_key, signature, timestamp + body):
            return

        self._info("discord.interactions.auth")
        raise DiscordRequestError(status=status.HTTP_401_UNAUTHORIZED)

    def _validate_data(self) -> None:
        try:
            self._data = self.request.data
        except (ValueError, TypeError):
            raise DiscordRequestError(status=status.HTTP_400_BAD_REQUEST)

    def validate_integration(self) -> None:
        self._integration = integration_service.get_integration(
            provider="discord", external_id=self.guild_id
        )

    def _log_request(self) -> None:
        self._info("discord.request")

    def _info(self, key: str) -> None:
        logger.info(key, extra={**self.logging_data})

    def _error(self, key: str) -> None:
        logger.error(key, extra={**self.logging_data})

    def is_ping(self) -> bool:
        return self._data.get("type", 0) == 1

    def is_command(self) -> bool:
        return self._data.get("type", 0) == 2
