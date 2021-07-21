import logging
from typing import Any, Optional

from rest_framework import status
from rest_framework.request import Request

from sentry.integrations.slack.requests.base import SlackRequest, SlackRequestError
from sentry.models import Identity, IdentityProvider

logger = logging.getLogger("sentry.integrations.slack")

COMMANDS = ["link", "unlink", "link team", "unlink team"]


class SlackEventRequest(SlackRequest):
    """
    An Event request sent from Slack.

    These requests require the same Data and Token validation as all other
    requests from Slack, but also event data validation.

    Challenge Requests
    ------------------
    Slack Event requests first start with a "challenge request". This is just a
    request Sentry needs to verifying using it's shared key.

    Challenge requests will have a ``type`` of ``url_verification``.
    """

    def __init__(self, request: Request) -> None:
        super().__init__(request)
        self.identity_str: Optional[str] = None

    @property
    def has_identity(self) -> bool:
        return self.identity_str is not None

    def validate(self) -> None:
        if self.is_challenge():
            # Challenge requests only include the Token and data to verify the
            # request, so only validate those.
            self._authorize()
            self._validate_data()
        else:
            # Non-Challenge requests need to validate everything plus the data
            # about the event.
            super().validate()
            self._validate_event()

    def is_challenge(self) -> bool:
        return self.data.get("type") == "url_verification"

    @property
    def type(self) -> str:
        return str(self.data.get("event", {}).get("type"))

    @property
    def user_id(self) -> Optional[Any]:
        data = self.request.data.get("event")
        return data["user"]

    @property
    def text(self) -> Any:
        data = self.request.data.get("event")
        return data.get("text")

    def _validate_event(self) -> None:
        if not self.data.get("event"):
            self._error("slack.event.invalid-event-data")
            raise SlackRequestError(status=400)

        if not self.data.get("event", {}).get("type"):
            self._error("slack.event.invalid-event-type")
            raise SlackRequestError(status=400)

    def _validate_integration(self) -> None:
        super()._validate_integration()

        if self.text and self.text in COMMANDS:
            try:
                idp = IdentityProvider.objects.get(type="slack", external_id=self.team_id)
            except IdentityProvider.DoesNotExist:
                logger.error("slack.action.invalid-team-id", extra={"slack_team": self.team_id})
                raise SlackRequestError(status=status.HTTP_403_FORBIDDEN)

            identities = Identity.objects.filter(idp=idp, external_id=self.user_id)
            self.identity_str = identities[0].user.email if identities else None

    def _log_request(self) -> None:
        self._info(f"slack.event.{self.type}")
