from abc import ABC
from enum import Enum
from typing import Any, Optional

from sentry.integrations.msteams.card_builder.base.base import MSTeamsMessageBuilder
from sentry.templatetags.sentry_helpers import absolute_uri
from sentry.utils.assets import get_asset_url


class TextSize(Enum):
    SMALL = "Small"
    MEDIUM = "Medium"
    LARGE = "Large"


class TextWeight(Enum):
    BOLDER = "Bolder"
    LIGHTER = "Lighter"


class BlockMSTeamsMessageBuilder(MSTeamsMessageBuilder, ABC):
    @staticmethod
    def get_text_block(text: str, size: Optional[TextSize] = None) -> Any:
        return {
            "type": "TextBlock",
            "text": text,
            "wrap": True,
            "size": size.value if size else None,
        }

    def get_logo_block(self) -> Any:
        self.get_image_block(get_asset_url("sentry", "images/sentry-glyph-black.png"))

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
