from __future__ import annotations

from enum import Enum
from typing import Literal, Sequence, TypedDict

from typing_extensions import NotRequired, TypeAlias, Unpack

from sentry.integrations.msteams.card_builder.utils import escape_markdown_special_chars
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
    STRETCH = "Stretch"


class ActionType(str, Enum):
    OPEN_URL = "Action.OpenUrl"
    SUBMIT = "Action.Submit"
    SHOW_CARD = "Action.ShowCard"


class ColumnWidth(str, Enum):
    STRETCH = "stretch"
    AUTO = "auto"


class ContentAlignment(str, Enum):
    CENTER = "Center"


class OpenUrlAction(TypedDict):
    type: Literal[ActionType.OPEN_URL]
    title: str
    url: str


class SubmitAction(TypedDict):
    type: Literal[ActionType.SUBMIT]
    title: str
    data: object


class ShowCardAction(TypedDict):
    type: Literal[ActionType.SHOW_CARD]
    title: str
    card: AdaptiveCard


Action: TypeAlias = OpenUrlAction | SubmitAction | ShowCardAction


class ActionSet(TypedDict):
    type: Literal["ActionSet"]
    actions: list[Action]


class _TextBlockNotRequired(TypedDict, total=False):
    size: TextSize
    weight: TextWeight
    horizontalAlignment: ContentAlignment
    spacing: Literal["None"]
    isSubtle: bool
    height: Literal["stretch"]
    wrap: bool
    fontType: Literal["Default"]


class TextBlock(_TextBlockNotRequired):
    type: Literal["TextBlock"]
    text: str


class _ImageBlockNotRequired(TypedDict, total=False):
    size: ImageSize
    height: str
    width: str


class ImageBlock(_ImageBlockNotRequired):
    type: Literal["Image"]
    url: str


class _ColumnBlockNotRequired(TypedDict, total=False):
    style: Literal["good", "warning", "attention"]
    isSubtle: bool
    spacing: str
    verticalContentAlignment: ContentAlignment


class ColumnBlock(_ColumnBlockNotRequired):
    type: Literal["Column"]
    items: list[Block]
    width: ColumnWidth | str


class ColumnSetBlock(TypedDict):
    type: Literal["ColumnSet"]
    columns: list[ColumnBlock]


class ContainerBlock(TypedDict):
    type: Literal["Container"]
    items: list[Block]


class InputChoice(TypedDict):
    title: str
    value: object


class _InputChoiceSetBlockNotRequired(TypedDict, total=False):
    value: object


class InputChoiceSetBlock(_InputChoiceSetBlockNotRequired):
    type: Literal["Input.ChoiceSet"]
    id: str
    choices: list[InputChoice]


ItemBlock: TypeAlias = str | TextBlock | ImageBlock
Block: TypeAlias = (
    ActionSet | TextBlock | ImageBlock | ColumnSetBlock | ContainerBlock | InputChoiceSetBlock
)


AdaptiveCard = TypedDict(
    "AdaptiveCard",
    {
        "body": list[Block],
        "type": str,
        "$schema": str,
        "version": str,
        "actions": NotRequired[list[Action]],
        "msteams": NotRequired[dict[str, str]],
    },
)


def create_text_block(text: str | None, **kwargs: Unpack[_TextBlockNotRequired]) -> TextBlock:
    kwargs.setdefault("wrap", True)
    return {
        "type": "TextBlock",
        "text": escape_markdown_special_chars(text) if text else "",
        **kwargs,
    }


def create_logo_block(**kwargs: Unpack[_ImageBlockNotRequired]) -> ImageBlock:
    # Default size if no size is given
    if not kwargs.get("height"):
        kwargs.setdefault("size", ImageSize.MEDIUM)

    return create_image_block(get_asset_url("sentry", SENTRY_ICON_URL), **kwargs)


def create_image_block(url: str, **kwargs: Unpack[_ImageBlockNotRequired]) -> ImageBlock:
    return {
        "type": "Image",
        "url": absolute_uri(url),
        **kwargs,
    }


def create_column_block(
    item: ItemBlock,
    *,
    width: ColumnWidth = ColumnWidth.AUTO,
    **kwargs: Unpack[_ColumnBlockNotRequired],
) -> ColumnBlock:
    if isinstance(item, str):
        item = create_text_block(item)

    return {
        "type": "Column",
        "items": [item],
        "width": width,
        **kwargs,
    }


def create_column_set_block(*columns: ColumnBlock) -> ColumnSetBlock:
    return {
        "type": "ColumnSet",
        "columns": list(columns),
    }


def create_action_set_block(*actions: Action) -> ActionSet:
    return {"type": "ActionSet", "actions": list(actions)}


def create_container_block(*items: Block) -> ContainerBlock:
    return {"type": "Container", "items": list(items)}


def create_input_choice_set_block(
    id: str, choices: Sequence[tuple[str, object]], default_choice: object
) -> InputChoiceSetBlock:
    default_choice_arg: _InputChoiceSetBlockNotRequired
    default_choice_arg = {"value": default_choice} if default_choice else {}
    return {
        "type": "Input.ChoiceSet",
        "id": id,
        "choices": [{"title": title, "value": value} for title, value in choices],
        **default_choice_arg,
    }


# Utilities to build footer in notification cards.


def create_footer_logo_block() -> ImageBlock:
    return create_logo_block(height="20px")


def create_footer_text_block(footer_text: str) -> TextBlock:
    return create_text_block(
        footer_text,
        size=TextSize.SMALL,
        weight=TextWeight.LIGHTER,
        wrap=False,
    )


def create_footer_column_block(footer_text_block: TextBlock) -> ColumnBlock:
    return create_column_block(
        footer_text_block,
        isSubtle=True,
        spacing="none",
        verticalContentAlignment=ContentAlignment.CENTER,
    )
