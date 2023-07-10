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
    def integration(self) -> RpcIntegration:
        if not self._integration:
            raise RuntimeError
        return self._integration

    @property
    def data(self) -> Mapping[str, object]:
        if not self._data:
            self._validate_data()
        return self._data

    @property
    def guild_id(self) -> str:
        return str(self.data.get("guild_id", None))

    @property
    def logging_data(self) -> Mapping[str, str]:
        _data: Mapping[str, object] = self.request.data
        # TODO: come back to this later and see what additional metadata makes sense to include here
        data: Mapping[str, str | None] = {
            "discord_guild_id": str(_data.get("guild_id", None)),
            "discord_channel_id": str(_data.get("channel_id", None)),
        }

        if self._integration:
            data["integration_id"] = str(self.integration.id)

        return {k: v for k, v in data.items() if v}

    def validate(self) -> None:
        self._log_request()
        self.authorize()
        self._validate_data()
        self.validate_integration()

    def authorize(self) -> None:
        public_key: str = options.get("discord.public-key")
        signature: str | None = self.request.META.get("HTTP_X_SIGNATURE_ED25519")
        timestamp: str | None = self.request.META.get("HTTP_X_SIGNATURE_TIMESTAMP")
        body: str = self.request.body.decode("utf-8")

        if signature and timestamp and verify_signature(public_key, signature, timestamp + body):
            return

        self._error("discord.interactions.auth")
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
