from typing import Any, Dict, Mapping, MutableMapping, Optional

from rest_framework import status as status_
from rest_framework.request import Request

from sentry import options
from sentry.models import Identity, IdentityProvider, Integration

from ..utils import check_signing_secret, logger


class SlackRequestError(Exception):
    """
    Something was invalid about the request from Slack.

    Includes the status the endpoint should return, based on the error.
    """

    def __init__(self, status: int) -> None:
        self.status = status


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
        self.integration: Optional[Integration] = None
        self._data: MutableMapping[str, Any] = {}
        self._log_request()

    def validate(self) -> None:
        """
        Ensure everything is present to properly process this request
        """
        self._authorize()
        self._validate_data()
        self._validate_integration()

    def is_challenge(self) -> bool:
        return False

    @property
    def has_identity(self) -> bool:
        raise NotImplementedError

    @property
    def type(self) -> str:
        # Found in different places, so this is implemented in each request's
        # specific object (``SlackEventRequest`` and ``SlackActionRequest``).
        raise NotImplementedError

    @property
    def channel_id(self) -> Optional[Any]:
        """
        Provide a normalized interface to ``channel_id``, which Action and Event
        requests provide in different places.
        """
        return self.data.get("channel_id") or self.data.get("channel", {}).get("id")

    @property
    def response_url(self) -> Optional[Any]:
        """Provide an interface to ``response_url`` for convenience."""
        return self.data.get("response_url")

    @property
    def team_id(self) -> Any:
        """
        Provide a normalized interface to ``team_id``, which Action and Event
        requests provide in different places.
        """
        return self.data.get("team_id") or self.data.get("team", {}).get("id")

    @property
    def user_id(self) -> Optional[Any]:
        """
        Provide a normalized interface to ``user_id``, which Action and Event
        requests provide in different places.
        """
        return self.data.get("user_id") or self.data.get("user", {}).get("id")

    @property
    def data(self) -> Mapping[str, Any]:
        if not self._data:
            self._validate_data()
        return self._data

    @property
    def logging_data(self) -> Dict[str, Any]:
        data = {
            "slack_team_id": self.team_id,
            "slack_channel_id": self.data.get("channel", {}).get("id"),
            "slack_user_id": self.data.get("user", {}).get("id"),
            "slack_event_id": self.data.get("event_id"),
            "slack_callback_id": self.data.get("callback_id"),
            "slack_api_app_id": self.data.get("api_app_id"),
        }

        if self.integration:
            data["integration_id"] = self.integration.id

        return {k: v for k, v in data.items() if v}

    def get_identity(self) -> Optional[Identity]:
        try:
            idp = IdentityProvider.objects.get(type="slack", external_id=self.team_id)
        except IdentityProvider.DoesNotExist as e:
            logger.error("slack.action.invalid-team-id", extra={"slack_team": self.team_id})
            raise e

        try:
            return Identity.objects.select_related("user").get(idp=idp, external_id=self.user_id)
        except Identity.DoesNotExist:
            return None

    def _validate_data(self) -> None:
        try:
            self._data = self.request.data
        except (ValueError, TypeError):
            raise SlackRequestError(status=status_.HTTP_400_BAD_REQUEST)

    def _authorize(self) -> None:
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

        # Explicitly typing to satisfy mypy.
        valid: bool = check_signing_secret(signing_secret, self.request.body, timestamp, signature)
        return valid

    def _check_verification_token(self, verification_token: str) -> bool:
        return self.data.get("token") == verification_token

    def _validate_integration(self) -> None:
        try:
            self.integration = Integration.objects.get(provider="slack", external_id=self.team_id)
        except Integration.DoesNotExist:
            self._error("slack.action.invalid-team-id")
            raise SlackRequestError(status=status_.HTTP_403_FORBIDDEN)

    def _log_request(self) -> None:
        self._info("slack.request")

    def _error(self, key: str) -> None:
        logger.error(key, extra=self.logging_data)

    def _info(self, key: str) -> None:
        logger.info(key, extra=self.logging_data)
