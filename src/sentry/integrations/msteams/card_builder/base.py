from __future__ import annotations

from abc import ABC
from enum import Enum
from typing import Any, Sequence

from sentry.integrations.msteams.card_builder import (
    Action,
    AdaptiveCard,
    ColumnBlock,
    ColumnSetBlock,
    ImageBlock,
    ItemBlock,
    TextBlock,
)
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


class ImageSize(str, Enum):
    SMALL = "Small"
    MEDIUM = "Medium"
    LARGE = "Large"
    AUTO = "Auto"
    STRECH = "Strech"


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
    def build(self) -> AdaptiveCard:
        """Abstract `build` method that all inheritors must implement."""
        raise NotImplementedError

    @staticmethod
    def get_text_block(text: str, **kwargs: str) -> TextBlock:
        return {"type": "TextBlock", "text": text, "wrap": True, **kwargs}

    def get_logo_block(self) -> ImageBlock:
        return self.get_image_block(get_asset_url("sentry", SENTRY_ICON_URL))

    @staticmethod
    def get_image_block(url: str) -> ImageBlock:
        return {
            "type": "Image",
            "url": absolute_uri(url),
            "size": ImageSize.MEDIUM,
        }

    def get_column_block(self, item: str | ItemBlock, **kwargs: str) -> ColumnBlock:
        kwargs["width"] = kwargs.get("width", ColumnWidth.AUTO)

        if isinstance(item, str):
            item = self.get_text_block(item)

        return {"type": "Column", "items": [item], **kwargs}

    @staticmethod
    def is_column(item):
        return isinstance(item, dict) and "Column" == item.get("type", "")

    def get_column_set_block(self, *columns: str | ItemBlock | ColumnBlock) -> ColumnSetBlock:
        columns = [
            column if self.is_column(column) else self.get_column_block(column)
            for column in columns
        ]
        return {
            "type": "ColumnSet",
            "columns": columns,
        }

    @staticmethod
    def get_action_block(action_type: ActionType, title: str, **kwargs: str) -> Action:
        param = REQUIRED_ACTION_PARAM[action_type]

        return {"type": action_type, "title": title, f"{param}": kwargs[param]}

    def build_card(
        self,
        text: str | ItemBlock = None,
        title: str | ItemBlock = None,
        fields: Sequence[str | ItemBlock] = None,
        footer: str | ItemBlock = None,
        actions: Sequence[Action] = None,
        **kwargs: Any,
    ) -> AdaptiveCard:
        """
        Helper to DRY up MS Teams specific fields.
        :param string text: Body text.
        :param [string] title: Title text.
        :param [string] footer: Footer text.
        :param kwargs: Everything else.
        """
        body = []

        fields = fields or []

        items = [title, text, *fields, footer]

        for item in items:
            if item:
                if isinstance(item, str):
                    item = self.get_text_block(item)

                body.append(item)

        return {
            "body": body,
            "type": "AdaptiveCard",
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.2",
            "actions": actions or [],
        }
