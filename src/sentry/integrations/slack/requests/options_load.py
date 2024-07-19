from __future__ import annotations

from typing import Any

import orjson
from rest_framework import status

from sentry.integrations.slack.requests.base import SlackRequest, SlackRequestError
from sentry.models.group import Group

VALID_PAYLOAD_TYPES = ["block_suggestion"]


class SlackOptionsLoadRequest(SlackRequest):
    """
    An Options Load request sent from Slack.
    """

    @property
    def group_id(self) -> int:
        if self.data.get("container", {}).get("is_app_unfurl"):
            return int(
                orjson.loads(
                    self.data["app_unfurl"]["blocks"][0]["block_id"],
                )["issue"]
            )
        return int(orjson.loads(self.data["message"]["blocks"][0]["block_id"])["issue"])

    @property
    def substring(self) -> str:
        return str(self.data.get("value"))

    def _validate_data(self) -> None:
        super()._validate_data()

        if "payload" not in self.request.data:
            raise SlackRequestError(status=status.HTTP_400_BAD_REQUEST)

        try:
            self._data = orjson.loads(self.data["payload"])
        except (KeyError, IndexError, TypeError, ValueError):
            raise SlackRequestError(status=status.HTTP_400_BAD_REQUEST)

        if self.data.get("type") not in VALID_PAYLOAD_TYPES:
            raise SlackRequestError(status=status.HTTP_400_BAD_REQUEST)

        if "value" not in self.data:
            raise SlackRequestError(status=status.HTTP_400_BAD_REQUEST)

    def _log_request(self) -> None:
        self._info("slack.options_load")

    def get_logging_data(self, group: Group | None = None) -> dict[str, Any]:
        logging_data: dict[str, Any] = {**self.logging_data, "response_url": self.response_url}

        if group:
            logging_data.update(
                {
                    "group_id": group.id,
                    "organization_id": group.organization.id,
                }
            )

        return logging_data
