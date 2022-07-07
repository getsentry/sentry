from abc import ABC
from enum import Enum
from typing import Any, Optional, Sequence

from sentry.integrations.notifications import AbstractMessageBuilder
from sentry.utils.assets import get_asset_url
from sentry.utils.http import absolute_uri

URL_FORMAT_STR = "[{text}]({url})"


class TextSize(Enum):
    SMALL = "Small"
    MEDIUM = "Medium"
    LARGE = "Large"


class TextWeight(Enum):
    BOLDER = "Bolder"
    LIGHTER = "Lighter"


class ActionType(Enum):
    OPEN_URL = "Action.OpenUrl"
    SUBMIT = "Action.Submit"
    SHOW_CARD = "Action.ShowCard"
    TOGGLE_VISIBILITY = "Action.ToggleVisibility"
    EXECUTE = "Action.Execute"


class MSTeamsMessageBuilder(AbstractMessageBuilder, ABC):
    def build(self) -> Any:
        """Abstract `build` method that all inheritors must implement."""
        raise NotImplementedError

    @staticmethod
    def get_text_block(
        text: str, size: Optional[TextSize] = None, weight: Optional[TextWeight] = None
    ) -> Any:
        return {
            "type": "TextBlock",
            "text": text,
            "wrap": True,
            "size": size.value if size else None,
            "weight": weight.value if weight else None,
        }

    def get_logo_block(self) -> Any:
        return self.get_image_block(get_asset_url("sentry", "images/sentry-glyph-black.png"))

    @staticmethod
    def get_image_block(url: str) -> Any:
        return {
            "type": "Image",
            "url": absolute_uri(url),
            "size": "Large",
        }

    @staticmethod
    def get_column_block(*columns: Any) -> Any:
        return {
            "type": "ColumnSet",
            "columns": [
                {"type": "Column", "items": [column], "width": "auto"} for column in columns
            ],
        }

    @staticmethod
    def get_action(action_type: ActionType, title: str, data: Any):
        return {
            "type": action_type,
            "title": title,
            "data": data,
        }

    def _build(
        self,
        text: Any,
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
