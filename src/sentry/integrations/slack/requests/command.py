from typing import Optional
from urllib.parse import parse_qs

from rest_framework import status
from rest_framework.request import Request

from sentry.integrations.slack.requests.base import SlackRequest, SlackRequestError
from sentry.models import IdentityProvider


class SlackCommandRequest(SlackRequest):
    """
    A Command request sent from Slack.

    Slack sends the command payload as `application/x-www-form-urlencoded`
    instead of JSON. This is slightly annoying because the values in the key-
    value pairs are all automatically wrapped in arrays.
    """

    def __init__(self, request: Request) -> None:
        super().__init__(request)
        self.identity_str: Optional[str] = None

    @property
    def channel_name(self) -> str:
        return self.data.get("channel_name", "")

    @property
    def has_identity(self) -> bool:
        return self.identity_str is not None

    def _validate_data(self) -> None:
        try:
            qs_data = parse_qs(self.request.body.decode("utf-8"), strict_parsing=True)
        except ValueError:
            raise SlackRequestError(status=status.HTTP_400_BAD_REQUEST)

        # Flatten the values.
        self._data = {key: value_array[0] for key, value_array in qs_data.items()}

        if not self._data.get("team_id"):
            raise SlackRequestError(status=status.HTTP_400_BAD_REQUEST)

    def _validate_integration(self) -> None:
        super()._validate_integration()
        try:
            identity = self.get_identity()
        except IdentityProvider.DoesNotExist:
            raise SlackRequestError(status=status.HTTP_403_FORBIDDEN)

        self.identity_str = identity.user.email if identity else None
