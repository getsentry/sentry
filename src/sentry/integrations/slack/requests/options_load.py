from __future__ import annotations

from typing import Any

import orjson
import sentry_sdk
from rest_framework import status

from sentry.features.rollout import in_random_rollout
from sentry.integrations.slack.requests.base import SlackRequest, SlackRequestError
from sentry.models.group import Group
from sentry.utils import json
from sentry.utils.json import JSONData

VALID_PAYLOAD_TYPES = ["block_suggestion"]


# TODO: remove this once we're confident that orjson is working as expected
def load_json(data: Any) -> JSONData:
    if in_random_rollout("integrations.slack.enable-orjson"):
        # Span is required because `json.loads` calls it by default
        with sentry_sdk.start_span(op="sentry.utils.json.loads"):
            return orjson.loads(data)
    return json.loads(data)


class SlackOptionsLoadRequest(SlackRequest):
    """
    An Options Load request sent from Slack.
    """

    @property
    def group_id(self) -> int:
        if self.data.get("container", {}).get("is_app_unfurl"):
            return int(load_json(self.data["app_unfurl"]["blocks"][0]["block_id"])["issue"])
        return int(load_json(self.data["message"]["blocks"][0]["block_id"])["issue"])

    @property
    def substring(self) -> str:
        return str(self.data.get("value"))

    def _validate_data(self) -> None:
        super()._validate_data()

        if "payload" not in self.request.data:
            raise SlackRequestError(status=status.HTTP_400_BAD_REQUEST)

        try:
            self._data = load_json(self.data["payload"])
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
