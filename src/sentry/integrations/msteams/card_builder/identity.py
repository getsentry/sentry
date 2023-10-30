from sentry.integrations.msteams.card_builder import AdaptiveCard
from sentry.integrations.msteams.card_builder.base import MSTeamsMessageBuilder

from .block import (
    ActionType,
    ColumnWidth,
    ImageSize,
    TextSize,
    create_action_block,
    create_column_block,
    create_column_set_block,
    create_logo_block,
    create_text_block,
)
from .utils import IdentityMessages


def build_unlinked_card() -> AdaptiveCard:
    return MSTeamsMessageBuilder().build(text=IdentityMessages.IDENTITY_UNLINKED)


def build_linked_card() -> AdaptiveCard:
    return MSTeamsMessageBuilder().build(
        text=create_column_set_block(
            create_column_block(create_logo_block(size=ImageSize.LARGE), width=ColumnWidth.AUTO),
            create_text_block(
                IdentityMessages.IDENTITY_LINKED,
                size=TextSize.LARGE,
            ),
        ),
    )


def build_linking_card(url: str) -> AdaptiveCard:
    return MSTeamsMessageBuilder().build(
        text=create_text_block(IdentityMessages.LINK_IDENTITY, size=TextSize.MEDIUM),
        actions=[
            create_action_block(
                ActionType.OPEN_URL, title=IdentityMessages.LINK_IDENTITY_BUTTON, url=url
            )
        ],
    )


def build_unlink_identity_card(url: str) -> AdaptiveCard:
    return MSTeamsMessageBuilder().build(
        text=IdentityMessages.UNLINK_IDENTITY,
        actions=[
            create_action_block(
                ActionType.OPEN_URL, title=IdentityMessages.UNLINK_IDENTITY_BUTTON, url=url
            )
        ],
    )


def build_link_identity_command_card() -> AdaptiveCard:
    return MSTeamsMessageBuilder().build(
        text=IdentityMessages.LINK_COMMAND_MESSAGE,
    )


def build_already_linked_identity_command_card() -> AdaptiveCard:
    return MSTeamsMessageBuilder().build(text=IdentityMessages.ALREADY_LINKED)
