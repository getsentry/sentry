from __future__ import annotations

import dataclasses
import logging
from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any

from rest_framework import status as status_
from rest_framework.request import Request
from slack_sdk.signature import SignatureVerifier

from sentry import options
from sentry.constants import ObjectStatus
from sentry.identity.services.identity import RpcIdentity, identity_service
from sentry.identity.services.identity.model import RpcIdentityProvider
from sentry.integrations.messaging.commands import CommandInput
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service
from sentry.utils.safe import get_path

_logger = logging.getLogger(__name__)


def _get_field_id_option(data: Mapping[str, Any], field_name: str) -> str | None:
    id_option: str | None = data.get(f"{field_name}_id") or get_path(data, field_name, "id")
    return id_option


def get_field_id(data: Mapping[str, Any], field_name: str) -> str:
    """
    TODO(mgaeta): Hack to convert optional strings to string. SlackRequest
     should be refactored to deserialize `data` in the constructor.
    """
    id_option = _get_field_id_option(data, field_name)
    if not id_option:
        raise RuntimeError
    return id_option


@dataclasses.dataclass(frozen=True)
class SlackRequestError(Exception):
    """
    Something was invalid about the request from Slack.
    Includes the status the endpoint should return, based on the error.
    """

    status: int


class SlackRequest:
    """
    Encapsulation of a request from Slack.

    Action and Event requests share much of the same validation needs and data
    access characteristics.

    Raises ``SlackRequestError`` if the request in invalid in some way (the
    payload missing, it not being JSON, etc.) ``SlackRequestError`` will also
    have the appropriate response code the endpoint should respond with, for
    the error that was raised.
    """

    def __init__(self, request: Request) -> None:
        self.request = request
        self._integration: RpcIntegration | None = None
        self._identity: RpcIdentity | None = None
        self._provider: RpcIdentityProvider | None = None
        self._user: RpcUser | None = None
        self._data: MutableMapping[str, Any] = {}

    def validate(self) -> None:
        """
        Ensure everything is present to properly process this request
        """
        self._log_request()
        self._get_context()
        self.authorize()
        self._validate_data()
        self.validate_integration()

    def is_bot(self) -> bool:
        """
        If it's a message posted by our bot, we don't want to respond since that
        will cause an infinite loop of messages.
        """
        return False

    def is_challenge(self) -> bool:
        return False

    def _get_context(self):
        team_id = None
        user_id = None
        # Let the intended validation methods handle the errors from reading these fields
        try:
            team_id = self.team_id
            user_id = self.user_id
        except Exception:
            pass
        context = integration_service.get_integration_identity_context(
            integration_provider="slack",
            integration_external_id=team_id,
            identity_external_id=user_id,
            identity_provider_external_id=team_id,
        )
        if not context:
            return
        self._integration = context.integration
        self._provider = context.identity_provider
        self._identity = context.identity
        self._user = context.user

    @property
    def integration(self) -> RpcIntegration:
        if not self._integration:
            raise RuntimeError
        return self._integration

    @property
    def channel_id(self) -> str | None:
        return get_field_id(self.data, "channel")

    @property
    def response_url(self) -> str:
        return self.data.get("response_url", "")

    @property
    def team_id(self) -> str | None:
        return _get_field_id_option(self.data, "team")

    @property
    def user_id(self) -> str | None:
        return _get_field_id_option(self.data, "user")

    @property
    def data(self) -> Mapping[str, Any]:
        if not self._data:
            self._validate_data()
        return self._data

    @property
    def logging_data(self) -> Mapping[str, str]:
        _data = self.request.data
        data = {
            "slack_team_id": _get_field_id_option(_data, "team"),
            "slack_channel_id": _get_field_id_option(_data, "channel"),
            "slack_user_id": _get_field_id_option(_data, "user"),
            "slack_event_id": _data.get("event_id"),
            "slack_callback_id": _data.get("callback_id"),
            "slack_api_app_id": _data.get("api_app_id"),
        }

        if self._integration:
            data["integration_id"] = self.integration.id

        return {k: v for k, v in data.items() if v}

    def get_identity(self) -> RpcIdentity | None:
        if self._identity is not None:
            return self._identity

        if self._provider is None:
            self._provider = identity_service.get_provider(
                provider_type="slack", provider_ext_id=self.team_id
            )

        if self._provider is not None:
            self._identity = identity_service.get_identity(
                filter={
                    "provider_id": self._provider.id,
                    "identity_ext_id": self.user_id,
                }
            )

        return self._identity

    def get_identity_user(self) -> RpcUser | None:
        if self._user:
            return self._user

        identity = self.get_identity()
        if not identity:
            return None

        self._user = user_service.get_user(identity.user_id)
        return self._user

    def _validate_data(self) -> None:
        try:
            self._data = self.request.data
        except (ValueError, TypeError):
            raise SlackRequestError(status=status_.HTTP_400_BAD_REQUEST)

    def authorize(self) -> None:
        # XXX(meredith): Signing secrets are the preferred way
        # but self-hosted could still have an older slack bot
        # app that just has the verification token.
        signing_secret = options.get("slack.signing-secret")
        verification_token = options.get("slack.verification-token")

        if signing_secret:
            if self._check_signing_secret(signing_secret):
                return
        elif verification_token and self._check_verification_token(verification_token):
            return

        # unfortunately, we can't know which auth was supposed to succeed
        self._error("slack.action.auth")
        raise SlackRequestError(status=status_.HTTP_401_UNAUTHORIZED)

    def _check_signing_secret(self, signing_secret: str) -> bool:
        signature = self.request.META.get("HTTP_X_SLACK_SIGNATURE")
        timestamp = self.request.META.get("HTTP_X_SLACK_REQUEST_TIMESTAMP")
        if not (signature and timestamp):
            return False

        return SignatureVerifier(signing_secret).is_valid(
            body=self.request.body, timestamp=timestamp, signature=signature
        )

    def _check_verification_token(self, verification_token: str) -> bool:
        return self.data.get("token") == verification_token

    def validate_integration(self) -> None:
        if not self._integration:
            self._integration = integration_service.get_integration(
                provider="slack", external_id=self.team_id, status=ObjectStatus.ACTIVE
            )

        if not self._integration:
            self._info("slack.action.invalid-team-id")
            raise SlackRequestError(status=status_.HTTP_403_FORBIDDEN)

    def _log_request(self) -> None:
        self._info("slack.request")

    def _error(self, key: str) -> None:
        _logger.error(key, extra={**self.logging_data})

    def _info(self, key: str) -> None:
        _logger.info(key, extra={**self.logging_data})


class SlackDMRequest(SlackRequest):
    def __init__(self, request: Request) -> None:
        super().__init__(request)
        self.user: RpcUser | None = None

    @property
    def has_identity(self) -> bool:
        return self.user is not None

    @property
    def identity_str(self) -> str | None:
        return self.user.email if self.user else None

    @property
    def dm_data(self) -> Mapping[str, Any]:
        raise NotImplementedError

    @property
    def type(self) -> str:
        return self.dm_data.get("type", "")

    @property
    def text(self) -> str:
        return self.dm_data.get("text", "")

    @property
    def channel_name(self) -> str:
        return self.dm_data.get("channel_name", "")

    def get_command_and_args(self) -> tuple[str, Sequence[str]]:
        command = self.text.lower().split()
        if not command:
            return "", []
        return command[0], command[1:]

    def get_command_input(self) -> CommandInput:
        cmd, args = self.get_command_and_args()
        return CommandInput(cmd, tuple(args))

    def _validate_identity(self) -> None:
        self.user = self.get_identity_user()
