from abc import ABC
from enum import Enum
from typing import Any, Optional, Sequence

from sentry.integrations.notifications import AbstractMessageBuilder
from sentry.utils.assets import get_asset_url
from sentry.utils.http import absolute_uri

SENTRY_ICON_URL = "images/sentry-glyph-black.png"

# NOTE: The classes below need to inherit from `str` as well to be serialized correctly.
# `TextSize.SMALL` has to serialized to `Small`, if not inheriting from `str` it would be
# serialized into something like `<TextSize.SMALL: 'Small'>`.


class TextSize(str, Enum):
    SMALL = "Small"
    MEDIUM = "Medium"
    LARGE = "Large"


class TextWeight(str, Enum):
    BOLDER = "Bolder"
    LIGHTER = "Lighter"


class ActionType(str, Enum):
    OPEN_URL = "Action.OpenUrl"
    SUBMIT = "Action.Submit"
    SHOW_CARD = "Action.ShowCard"


class ColumnWidth(str, Enum):
    STRECH = "strech"
    AUTO = "auto"


class VerticalContentAlignment(str, Enum):
    CENTER = "Center"


REQUIRED_ACTION_PARAM = {
    ActionType.OPEN_URL: "url",
    ActionType.SUBMIT: "data",
    ActionType.SHOW_CARD: "card",
}


class MSTeamsMessageBuilder(AbstractMessageBuilder, ABC):  # type: ignore
    def build(self) -> Any:
        """Abstract `build` method that all inheritors must implement."""
        raise NotImplementedError

    @staticmethod
    def get_text_block(text: str, **kwargs: str) -> Any:
        return {"type": "TextBlock", "text": text, "wrap": True, **kwargs}

    def get_logo_block(self) -> Any:
        return self.get_image_block(get_asset_url("sentry", SENTRY_ICON_URL))

    @staticmethod
    def get_image_block(url: str) -> Any:
        return {
            "type": "Image",
            "url": absolute_uri(url),
            "size": "Medium",
        }

    @staticmethod
    def get_column_block(item: Any, **kwargs: str) -> Any:
        kwargs["width"] = kwargs.get("width", ColumnWidth.AUTO)

        return {"type": "Column", "items": [item], **kwargs}

    @staticmethod
    def get_column_set_block(*columns: Any) -> Any:
        return {
            "type": "ColumnSet",
            "columns": list(columns),
        }

    @staticmethod
    def get_action_block(action_type: ActionType, title: str, **kwargs: str) -> Any:
        param = REQUIRED_ACTION_PARAM[action_type]

        return {"type": action_type, "title": title, f"{param}": kwargs[param]}

    def _build(
        self,
        text: Optional[Any] = None,
        title: Optional[Any] = None,
        footer: Optional[Any] = None,
        actions: Optional[Sequence[Any]] = None,
        **kwargs: Any,
    ) -> Any:
        """
        Helper to DRY up MS Teams specific fields.
        :param string text: Body text.
        :param [string] title: Title text.
        :param [string] footer: Footer text.
        :param kwargs: Everything else.
        """
        body = []
        if title:
            body.append(title)
        if text:
            body.append(text)

        body.extend(kwargs.get("fields", []))

        if footer:
            body.append(footer)

        return {
            "body": body,
            "type": "AdaptiveCard",
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.2",
            "actions": actions or [],
        }
