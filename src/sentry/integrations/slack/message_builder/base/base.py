from abc import ABC
from typing import Any, Optional

from sentry.integrations.slack.message_builder import LEVEL_TO_COLOR, SlackAttachment, SlackBody
from sentry.integrations.slack.message_builder.base import AbstractMessageBuilder
from sentry.utils.assets import get_asset_url
from sentry.utils.http import absolute_uri


class SlackMessageBuilder(AbstractMessageBuilder, ABC):
    def build(self) -> SlackBody:
        """Abstract `build` method that all inheritors must implement."""
        raise NotImplementedError

    @staticmethod
    def _build(
        text: str,
        title: Optional[str] = None,
        footer: Optional[str] = None,
        color: Optional[str] = None,
        **kwargs: Any,
    ) -> SlackAttachment:
        """
        Helper to DRY up Slack specific fields.

        :param string text: Body text.
        :param [string] title: Title text.
        :param [string] footer: Footer text.
        :param [string] color: The key in the Slack palate table, NOT hex. Default: "info".
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

        return {
            "text": text,
            "mrkdwn_in": ["text"],
            "color": LEVEL_TO_COLOR[color or "info"],
            **kwargs,
        }
