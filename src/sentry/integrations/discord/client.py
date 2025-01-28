from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any
from urllib.parse import urlencode

import orjson
from requests.models import Response
from rest_framework import status

from sentry import options
from sentry.integrations.client import ApiClient
from sentry.integrations.discord.message_builder.base.base import DiscordMessageBuilder
from sentry.integrations.discord.utils.consts import DISCORD_ERROR_CODES, DISCORD_USER_ERRORS
from sentry.shared_integrations.exceptions import ApiError

# to avoid a circular import
from sentry.utils import metrics

logger = logging.getLogger("sentry.integrations.discord")


DISCORD_BASE_URL = "https://discord.com/api/v10"

# https://discord.com/developers/docs/resources/guild#get-guild
GUILD_URL = "/guilds/{guild_id}"

# https://discord.com/developers/docs/resources/user#leave-guild
USERS_GUILD_URL = "/users/@me/guilds/{guild_id}"

# https://discord.com/developers/docs/interactions/application-commands#get-global-application-commands
APPLICATION_COMMANDS_URL = "/applications/{application_id}/commands"

# https://discord.com/developers/docs/resources/channel#get-channel
CHANNEL_URL = "/channels/{channel_id}"

# https://discord.com/developers/docs/resources/channel#create-message
MESSAGE_URL = "/channels/{channel_id}/messages"

TOKEN_URL = "/oauth2/token"

USER_URL = "/users/@me"


class DiscordClient(ApiClient):
    integration_name: str = "discord"
    base_url: str = DISCORD_BASE_URL
    _METRICS_FAILURE_KEY: str = "sentry.integrations.discord.failure"
    _METRICS_SUCCESS_KEY: str = "sentry.integrations.discord.success"
    _METRICS_USER_ERROR_KEY: str = "sentry.integrations.discord.failure.user_error"
    _METRICS_RATE_LIMIT_KEY: str = "sentry.integrations.discord.failure.rate_limit"

    def __init__(self):
        super().__init__()
        self.application_id = options.get("discord.application-id")
        self.client_secret = options.get("discord.client-secret")
        self.bot_token = options.get("discord.bot-token")

    def prepare_auth_header(self) -> dict[str, str]:
        return {"Authorization": f"Bot {self.bot_token}"}

    def set_application_command(self, command: object) -> None:
        self.post(
            APPLICATION_COMMANDS_URL.format(application_id=self.application_id),
            headers=self.prepare_auth_header(),
            data=command,
        )

    def has_application_commands(self) -> bool:
        response = self.get(
            APPLICATION_COMMANDS_URL.format(application_id=self.application_id),
            headers=self.prepare_auth_header(),
        )
        return bool(response)

    def get_guild_name(self, guild_id: str) -> str:
        response = self.get(GUILD_URL.format(guild_id=guild_id), headers=self.prepare_auth_header())
        return response["name"]

    def get_access_token(self, code: str, url: str):
        data = {
            "client_id": self.application_id,
            "client_secret": self.client_secret,
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": url,
            "scope": "identify",
        }
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
        }
        response = self.post(TOKEN_URL, json=False, data=urlencode(data), headers=headers)
        return response["access_token"]

    def get_user_id(self, access_token: str):
        headers = {"Authorization": f"Bearer {access_token}"}
        response = self.get(
            USER_URL,
            headers=headers,
        )
        return response["id"]

    def check_user_bot_installation_permission(self, access_token: str, guild_id: str) -> bool:
        headers = {"Authorization": f"Bearer {access_token}"}

        # We only want information about guild_id and check the user's permission in the guild, but we can't currently do that
        # https://github.com/discord/discord-api-docs/discussions/6846
        # TODO(iamrajjoshi): Eventually, we should use `/users/@me/guilds/{guild.id}/member`
        # Instead, we check if the user in a member of the guild

        try:
            self.get(f"/users/@me/guilds/{guild_id}/member", headers=headers)
        except ApiError as e:
            if e.code == 404:
                return False

        return True

    def leave_guild(self, guild_id: str) -> None:
        """
        Leave the given guild_id, if the bot is currently a member.
        """
        self.delete(USERS_GUILD_URL.format(guild_id=guild_id), headers=self.prepare_auth_header())

    def get_channel(self, channel_id: str) -> object | None:
        """
        Get a channel by id.
        """
        return self.get(
            CHANNEL_URL.format(channel_id=channel_id), headers=self.prepare_auth_header()
        )

    def track_response_data(
        self,
        code: str | int,
        error: Exception | None = None,
        resp: Response | None = None,
        extra: Mapping[str, str] | None = None,
    ) -> None:
        """
        Handle response from Discord by logging and capturing metrics
        """
        log_params = {
            "code": code,
            "error": str(error),
            "extra": extra,
        }

        if self.integration_type:
            log_params[str(self.integration_type)] = self.name

        try:
            logging_context = getattr(self, "logging_context", None)
            log_params["logging_context"] = logging_context
        except Exception:
            pass

        is_ok = code in {
            status.HTTP_200_OK,
            status.HTTP_201_CREATED,
            status.HTTP_202_ACCEPTED,
            status.HTTP_204_NO_CONTENT,
        }

        if not is_ok or error:
            code_to_use = code if isinstance(code, int) else None
            self._handle_failure(code=code_to_use, log_params=log_params, resp=resp)
        else:
            self._handle_success(log_params=log_params)

    def _handle_failure(
        self,
        code: int | None,
        log_params: dict[str, Any],
        resp: Response | None = None,
    ) -> None:
        """
        Do extra logic to handle an error from Discord
        """

        discord_error_response: dict | None = None
        if resp is not None:
            # Try to get the additional error code that Discord sent us to help determine what specific error happened
            try:
                discord_error_response = orjson.loads(resp.content)
                log_params["discord_error_response"] = discord_error_response
            except Exception as err:
                self.logger.info(
                    "error trying to handle discord error message", exc_info=err, extra=log_params
                )

        discord_error_code = None
        if discord_error_response is not None:
            # Discord sends us a special code for errors in the response data
            # https://discord.com/developers/docs/topics/opcodes-and-status-codes#json
            discord_error_code = str(discord_error_response.get("code", ""))
            log_params["discord_error_code"] = discord_error_code

            # Get the specific meaning for those codes
            if discord_error_code_message := DISCORD_ERROR_CODES.get(discord_error_code, None):
                log_params["discord_error_code_message"] = discord_error_code_message

        # Check if the error is due to a user configuration error, which we do not have control over to fix
        # An example of this would be if the user deleted the discord guild and never updated the alert action
        is_user_error = discord_error_code in DISCORD_USER_ERRORS
        log_params["is_user_error"] = is_user_error

        if is_user_error:
            metrics_key = self._METRICS_USER_ERROR_KEY
        else:
            metrics_key = (
                self._METRICS_RATE_LIMIT_KEY
                if code is not None and code == status.HTTP_429_TOO_MANY_REQUESTS
                else self._METRICS_FAILURE_KEY
            )

        metrics.incr(
            metrics_key,
            sample_rate=1.0,
        )
        self.logger.info("handled discord error", extra=log_params)

    def _handle_success(
        self,
        log_params: dict[str, Any],
    ) -> None:
        metrics.incr(
            self._METRICS_SUCCESS_KEY,
            sample_rate=1.0,
        )
        self.logger.info("handled discord success", extra=log_params)

    def send_message(
        self, channel_id: str, message: DiscordMessageBuilder, notification_uuid: str | None = None
    ) -> None:
        """
        Send a message to the specified channel.
        """
        self.post(
            MESSAGE_URL.format(channel_id=channel_id),
            data=message.build(notification_uuid=notification_uuid),
            timeout=5,
            headers=self.prepare_auth_header(),
        )
