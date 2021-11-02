from __future__ import annotations

from abc import ABC
from typing import Any, Sequence

from sentry.integrations.slack.message_builder import LEVEL_TO_COLOR, SlackBody
from sentry.integrations.slack.message_builder.base import AbstractMessageBuilder
from sentry.notifications.notifications.base import MessageAction
from sentry.utils.assets import get_asset_url
from sentry.utils.http import absolute_uri


class SlackMessageBuilder(AbstractMessageBuilder, ABC):
    def build(self) -> SlackBody:
        """Abstract `build` method that all inheritors must implement."""
        raise NotImplementedError

    @staticmethod
    def _build(
        text: str,
        title: str | None = None,
        title_link: str | None = None,
        footer: str | None = None,
        color: str | None = None,
        actions: Sequence[MessageAction] | None = None,
        **kwargs: Any,
    ) -> SlackBody:
        """
        Helper to DRY up Slack specific fields.

        :param string text: Body text.
        :param [string] title: Title text.
        :param [string] title_link: Optional URL attached to the title.
        :param [string] footer: Footer text.
        :param [string] color: The key in the Slack palate table, NOT hex. Default: "info".
        :param [list[MessageAction]] actions: List of actions displayed alongside the message.
        :param kwargs: Everything else.
        """
        # If `footer` string is passed, automatically attach a `footer_icon`.
        if footer:
            kwargs["footer"] = footer
            kwargs["footer_icon"] = str(
                absolute_uri(get_asset_url("sentry", "images/sentry-email-avatar.png"))
            )

        if title:
            kwargs["title"] = title
            if title_link:
                kwargs["title_link"] = title_link

        if actions:
            kwargs["actions"] = [
                {
                    "text": action.label,
                    "name": action.label,
                    "url": action.url,
                    "style": action.style or "default",
                    "type": "button",
                }
                for action in actions
            ]

        return [
            {
                "text": text,
                "mrkdwn_in": ["text"],
                "color": LEVEL_TO_COLOR[color or "info"],
                **kwargs,
            }
        ]
