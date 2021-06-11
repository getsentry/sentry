from sentry.integrations.slack.requests.base import SlackRequest, SlackRequestError


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

    def _validate_event(self) -> None:
        if not self.data.get("event"):
            self._error("slack.event.invalid-event-data")
            raise SlackRequestError(status=400)

        if not self.data.get("event", {}).get("type"):
            self._error("slack.event.invalid-event-type")
            raise SlackRequestError(status=400)

    def _log_request(self) -> None:
        self._info(f"slack.event.{self.type}")
