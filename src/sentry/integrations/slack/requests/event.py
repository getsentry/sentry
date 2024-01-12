from __future__ import annotations

from typing import Any, Mapping

from sentry.integrations.slack.requests.base import SlackDMRequest, SlackRequestError
from sentry.integrations.slack.unfurl import LinkType, match_link

COMMANDS = ["link", "unlink", "link team", "unlink team"]


def has_discover_links(links: list[str]) -> bool:
    return any(match_link(link)[0] == LinkType.DISCOVER for link in links)


def is_event_challenge(data: Mapping[str, Any]) -> bool:
    return data.get("type", "") == "url_verification"


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

    def validate(self) -> None:
        if self.is_challenge():
            # Challenge requests only include the Token and data to verify the
            # request, so only validate those.
            self._info("slack.event.url_verification")
            self.authorize()
            super(SlackDMRequest, self)._validate_data()
        else:
            # Non-Challenge requests need to validate everything plus the data
            # about the event.
            super().validate()
            self._validate_event()

    def is_challenge(self) -> bool:
        """We need to call this before validation."""
        return is_event_challenge(self.request.data)

    @property
    def dm_data(self) -> Mapping[str, Any]:
        return self.data.get("event", {})

    @property
    def channel_id(self) -> str:
        return self.dm_data.get("channel", "")

    @property
    def user_id(self) -> str:
        return self.dm_data.get("user", "")

    @property
    def links(self) -> list[str]:
        return [link["url"] for link in self.dm_data.get("links", []) if "url" in link]

    def _validate_event(self) -> None:
        if not self.dm_data:
            self._error("slack.event.invalid-event-data")
            raise SlackRequestError(status=400)

        if not self.dm_data.get("type"):
            self._error("slack.event.invalid-event-type")
            raise SlackRequestError(status=400)

    def validate_integration(self) -> None:
        super().validate_integration()

        if (self.text in COMMANDS) or (
            self.type == "link_shared" and has_discover_links(self.links)
        ):
            self._validate_identity()

    def _log_request(self) -> None:
        self._info(f"slack.event.{self.type}")

    def is_bot(self) -> bool:
        return bool(self.dm_data.get("bot_id"))
