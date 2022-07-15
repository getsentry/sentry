from __future__ import annotations

from enum import Enum
from typing import Any, Sequence, Tuple, cast

from sentry.integrations.msteams.card_builder import (
    Action,
    ActionSet,
    Block,
    ColumnBlock,
    ColumnSetBlock,
    ContainerBlock,
    ImageBlock,
    InputChoiceSetBlock,
    ItemBlock,
    TextBlock,
)
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


def create_text_block(text: str, **kwargs: str | bool) -> TextBlock:
    return {
        "type": "TextBlock",
        "text": text,
        "wrap": True,
        **kwargs,
    }


def create_logo_block(**kwargs: str) -> ImageBlock:
    # Default size if no size is given
    if "height" not in kwargs:
        kwargs["size"] = ImageSize.MEDIUM

    return create_image_block(get_asset_url("sentry", SENTRY_ICON_URL), **kwargs)


def create_image_block(url: str, **kwargs: str) -> ImageBlock:
    return {
        "type": "Image",
        "url": absolute_uri(url),
        **kwargs,
    }


def create_column_block(item: ItemBlock, **kwargs: Any) -> ColumnBlock:
    kwargs["width"] = kwargs.get("width", ColumnWidth.AUTO)

    if isinstance(item, str):
        item = create_text_block(item)

    return {
        "type": "Column",
        "items": [item],
        **kwargs,
    }


def ensure_column_block(item: ItemBlock | ColumnBlock) -> ColumnBlock:
    if isinstance(item, dict) and "Column" == item.get("type", ""):
        return item

    return create_column_block(cast(ItemBlock, item))


def create_column_set_block(*columns: ItemBlock | ColumnBlock) -> ColumnSetBlock:
    return {
        "type": "ColumnSet",
        "columns": [ensure_column_block(column) for column in columns],
    }


def create_action_block(action_type: ActionType, title: str, **kwargs: Any) -> Action:
    param = REQUIRED_ACTION_PARAM[action_type]

    return {
        "type": action_type,
        "title": title,
        param: kwargs[param],
    }


def create_action_set_block(*actions: Action) -> ActionSet:
    return {"type": "ActionSet", "actions": list(actions)}


def create_container_block(*items: Block) -> ContainerBlock:
    return {"type": "Container", "items": list(items)}


def create_input_choice_set_block(
    id: str, choices: Sequence[Tuple[str, Any]], default_choice: Any
) -> InputChoiceSetBlock:
    default_choice_arg = {"value": default_choice} if default_choice else {}

    return {
        "type": "Input.ChoiceSet",
        "id": id,
        "choices": [{"title": title, "value": value} for title, value in choices],
        **default_choice_arg,
    }

    # if default_choice:
    #     input_choice_set_block.update({"value": default_choice})

    # return input_choice_set_block
