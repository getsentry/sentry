from __future__ import annotations

from typing import Any, Mapping
from urllib.parse import parse_qs

from rest_framework import status

from sentry.integrations.slack.requests.base import SlackDMRequest, SlackRequestError


class SlackCommandRequest(SlackDMRequest):
    """
    A Command request sent from Slack.

    Slack sends the command payload as `application/x-www-form-urlencoded`
    instead of JSON. This is slightly annoying because the values in the key-
    value pairs are all automatically wrapped in arrays.
    """

    @property
    def dm_data(self) -> Mapping[str, Any]:
        return self.data

    def _validate_data(self) -> None:
        try:
            qs_data = parse_qs(self.request.body.decode("utf-8"), strict_parsing=True)
        except ValueError:
            raise SlackRequestError(status=status.HTTP_400_BAD_REQUEST)

        # Flatten the values.
        self._data = {key: value_array[0] for key, value_array in qs_data.items()}

        if not self._data.get("team_id"):
            raise SlackRequestError(status=status.HTTP_400_BAD_REQUEST)

    def validate_integration(self) -> None:
        super().validate_integration()
        self._validate_identity()
