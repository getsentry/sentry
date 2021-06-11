import hmac
from hashlib import sha256
from typing import Any, Mapping, MutableMapping, Optional

from rest_framework.request import Request

from sentry import options
from sentry.models import Integration

from ..utils import logger
from .errors import SlackRequestError


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
        self.integration: Optional[Any] = None
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
    def type(self) -> str:
        # Found in different places, so this is implemented in each request's
        # specific object (``SlackEventRequest`` and ``SlackActionRequest``).
        raise NotImplementedError

    @property
    def team_id(self) -> Any:
        """
        Provide a normalized interface to ``team_id``, which Action and Event
        requests provide in different places.
        """
        return self.data.get("team_id") or self.data.get("team", {}).get("id")

    @property
    def data(self) -> Mapping[str, Any]:
        if not self._data:
            self._validate_data()
        return self._data

    @property
    def logging_data(self) -> Mapping[str, str]:
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

    def _validate_data(self) -> None:
        try:
            self._data = self.request.data
        except (ValueError, TypeError):
            raise SlackRequestError(status=400)

    # TODO MARCOS FIRST
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
        raise SlackRequestError(status=401)

    def _check_signing_secret(self, signing_secret: str) -> bool:
        # Taken from: https://github.com/slackapi/python-slack-events-api/blob/master/slackeventsapi/server.py#L47
        # Slack docs on this here: https://api.slack.com/authentication/verifying-requests-from-slack#about
        signature = self.request.META["HTTP_X_SLACK_SIGNATURE"]
        timestamp = self.request.META["HTTP_X_SLACK_REQUEST_TIMESTAMP"]

        req = b"v0:%s:%s" % (timestamp.encode("utf-8"), self.request.body)
        request_hash = "v0=" + hmac.new(signing_secret.encode("utf-8"), req, sha256).hexdigest()
        return hmac.compare_digest(request_hash.encode("utf-8"), signature.encode("utf-8"))

    def _check_verification_token(self, verification_token: str) -> bool:
        return self.data.get("token") == verification_token

    def _validate_integration(self) -> None:
        try:
            self.integration = Integration.objects.get(provider="slack", external_id=self.team_id)
        except Integration.DoesNotExist:
            self._error("slack.action.invalid-team-id")
            raise SlackRequestError(status=403)

    def _log_request(self) -> None:
        self._info("slack.request")

    def _error(self, key: str) -> None:
        logger.error(key, extra=self.logging_data)

    def _info(self, key: str) -> None:
        logger.info(key, extra=self.logging_data)
