from __future__ import annotations

import logging
from typing import Any

import orjson
from django.utils.functional import cached_property
from rest_framework import status

from sentry.integrations.slack.requests.base import SlackRequest, SlackRequestError
from sentry.models.group import Group

logger = logging.getLogger(__name__)


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

    @cached_property
    def callback_data(self) -> Any:
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
            return orjson.loads(self.data["callback_id"])

        # XXX(CEO): can't really feature flag this but the block kit data is very different

        # slack sends us a response when a modal is opened and when an option is selected
        # we don't do anything with it until the user hits "Submit" but we need to handle it anyway
        if self.data["type"] == "block_actions":
            if self.data.get("view"):
                return orjson.loads(self.data["view"]["private_metadata"])

            elif self.data.get("container", {}).get(
                "is_app_unfurl"
            ):  # for actions taken on interactive unfurls
                return orjson.loads(
                    self.data["app_unfurl"]["blocks"][0]["block_id"],
                )
            return orjson.loads(self.data["message"]["blocks"][0]["block_id"])

        if self.data["type"] == "view_submission":
            return orjson.loads(self.data["view"]["private_metadata"])

        for data in self.data["message"]["blocks"]:
            if data["type"] == "section" and len(data["block_id"]) > 5:
                return orjson.loads(data["block_id"])
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
            self._data = orjson.loads(self.data["payload"])
        except (KeyError, IndexError, TypeError, ValueError):
            raise SlackRequestError(status=status.HTTP_400_BAD_REQUEST)

        # for interactive unfurls with block kit
        if (
            self.data.get("type") == "block_actions"
            and self.data.get("container", {}).get("is_app_unfurl")
            and ("app_unfurl" not in self.data or len(self.data["app_unfurl"]["blocks"]) == 0)
        ):
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
        blocks = self.data.get("message", {}).get("blocks", [{}])
        tags = set()
        for block in blocks:
            if "tags" not in block.get("block_id", ""):
                continue

            text: str = block.get("text", {}).get("text", "")
            tag_keys = text.split("`")

            for i, tag_key in enumerate(tag_keys):
                # the tags are organized as tag_key: tag_value, so even indexed tags are keys
                if i % 2 == 1:
                    continue

                if tag_key.strip().endswith(":"):
                    tags.add(tag_key.strip(": "))
        return tags

    def get_action_ts(self) -> str | None:
        """
        Get the action timestamp from the Slack request data.

        Returns:
            str | None: The action timestamp if available, None otherwise.
        """
        actions = self.data.get("actions", [])
        if actions and isinstance(actions, list) and len(actions) > 0:
            (action,) = actions
            return action.get("action_ts")
        return None
