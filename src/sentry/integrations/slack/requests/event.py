from __future__ import annotations

from typing import Any

from rest_framework import status

from sentry.integrations.slack.requests.base import SlackDMRequest, SlackRequestError
from sentry.integrations.slack.unfurl import LinkType, match_link
from sentry.models import IdentityProvider

COMMANDS = ["link", "unlink", "link team", "unlink team"]


def has_discover_links(links: list[str]) -> bool:
    return any(match_link(link)[0] == LinkType.DISCOVER for link in links)


class SlackEventRequest(SlackDMRequest):
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

    @property
    def identity_str(self) -> str | None:
        return self.user.email if self.user else None

    @property
    def channel_name(self) -> str:
        # Explicitly typing to satisfy mypy.
        channel: str = self.data.get("event", {}).get("channel", "")
        return channel

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
    def user_id(self) -> str:
        # Explicitly typing to satisfy mypy.
        user: str = self.request.data.get("event", {}).get("user", "")
        return user

    @property
    def text(self) -> Any:
        data = self.request.data.get("event")
        return data.get("text")

    @property
    def links(self) -> list[str]:
        links = self.data.get("event", {}).get("links", [])
        return [link["url"] for link in links if "url" in link]

    def _validate_event(self) -> None:
        if not self.data.get("event"):
            self._error("slack.event.invalid-event-data")
            raise SlackRequestError(status=400)

        if not self.data.get("event", {}).get("type"):
            self._error("slack.event.invalid-event-type")
            raise SlackRequestError(status=400)

    def _validate_integration(self) -> None:
        super()._validate_integration()

        if (self.text in COMMANDS) or (
            self.type == "link_shared" and has_discover_links(self.links)
        ):
            try:
                identity = self.get_identity()
            except IdentityProvider.DoesNotExist:
                raise SlackRequestError(status=status.HTTP_403_FORBIDDEN)

            self._user = identity.user if identity else None

    def _log_request(self) -> None:
        self._info(f"slack.event.{self.type}")

    def is_bot(self) -> bool:
        return bool(self.data.get("event", {}).get("bot_id"))
