from __future__ import annotations

from typing import Any

from rest_framework import status

from sentry.integrations.slack.requests.base import SlackRequest, SlackRequestError
from sentry.models.group import Group
from sentry.utils import json
from sentry.utils.cache import memoize
from sentry.utils.json import JSONData


class SlackActionRequest(SlackRequest):
    """
    An Action request sent from Slack.

    Action requests nest their data inside of a ``payload`` key in the request
    body, for some reason. Therefore they require an extra bit of data
    validation.
    """

    @property
    def type(self) -> str:
        return str(self.data.get("type"))

    @memoize
    def callback_data(self) -> JSONData:
        """
        We store certain data in ``callback_id`` as JSON. It's a bit hacky, but
        it's the simplest way to store state without saving it on the Sentry
        side.

        Data included in this field:
            - issue: the ID of the corresponding Issue
            - orig_response_url: URL from the original message we received
            - is_message: did the original message have a 'message' type
        """
        if self.data.get("callback_id"):
            return json.loads(self.data["callback_id"])

        # XXX(CEO): can't really feature flag this but the block kit data is very different

        # slack sends us a response when a modal is opened and when an option is selected
        # we don't do anything with it until the user hits "Submit" but we need to handle it anyway
        if self.data["type"] == "block_actions":
            if self.data.get("view"):
                return json.loads(self.data["view"]["private_metadata"])
            return json.loads(self.data["message"]["blocks"][0]["block_id"])

        if self.data["type"] == "view_submission":
            return json.loads(self.data["view"]["private_metadata"])

        for data in self.data["message"]["blocks"]:
            if data["type"] == "section" and len(data["block_id"]) > 5:
                return json.loads(data["block_id"])
                # a bit hacky, you can only provide a block ID per block (not per entire message),
                # and if not provided slack generates a 5 char long one. our provided block_id is at least '{issue: <issue_id>}'
                # so we know it's longer than 5 chars

    def _validate_data(self) -> None:
        """
        Action requests provide the body of the request differently than Event
        requests (nested in a ``payload`` attribute), so there's extra
        validation needed.
        """
        super()._validate_data()

        if "payload" not in self.request.data:
            raise SlackRequestError(status=status.HTTP_400_BAD_REQUEST)

        try:
            self._data = json.loads(self.data["payload"])
        except (KeyError, IndexError, TypeError, ValueError):
            raise SlackRequestError(status=status.HTTP_400_BAD_REQUEST)

    def _log_request(self) -> None:
        self._info("slack.action")

    def get_logging_data(
        self,
        group: Group | None = None,
    ) -> dict[str, Any]:
        logging_data: dict[str, Any] = {
            **self.logging_data,
            "response_url": self.response_url,
        }

        if group:
            logging_data.update(
                {
                    "group_id": group.id,
                    "organization_id": group.organization.id,
                }
            )

        return logging_data

    def get_tags(self) -> set[str]:
        attachments = self.data.get("original_message", {}).get("attachments", [{}])
        tags = set()
        for attachment in attachments:
            for field in attachment.get("fields", []):
                tags.add(field["title"])
        return tags
