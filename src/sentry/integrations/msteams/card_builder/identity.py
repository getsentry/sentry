from typing import Any

from sentry.integrations.msteams.card_builder.base import MSTeamsMessageBuilder

from .block import (
    ActionType,
    TextSize,
    create_action_block,
    create_column_set_block,
    create_logo_block,
    create_text_block,
)
from .utils import IdentityMessages


class MSTeamsUnlinkedMessageBuilder(MSTeamsMessageBuilder):
    def build(self) -> Any:
        return self.build_card(text=IdentityMessages.IDENTITY_UNLINKED)


class MSTeamsLinkedMessageBuilder(MSTeamsMessageBuilder):
    def build(self) -> Any:
        return self.build_card(
            text=create_column_set_block(
                create_logo_block(),
                create_text_block(
                    IdentityMessages.IDENTITY_LINKED,
                    size=TextSize.LARGE,
                ),
            ),
        )


class MSTeamsLinkIdentityMessageBuilder(MSTeamsMessageBuilder):
    def __init__(self, url: str):
        self.url = url

    def build(self) -> Any:
        return self.build_card(
            text=create_text_block(IdentityMessages.LINK_IDENTITY, size=TextSize.MEDIUM),
            actions=[
                create_action_block(
                    ActionType.OPEN_URL, title=IdentityMessages.LINK_IDENTITY_BUTTON, url=self.url
                )
            ],
        )


class MSTeamsUnlinkIdentityMessageBuilder(MSTeamsMessageBuilder):
    def __init__(self, url: str):
        self.url = url

    def build(self) -> Any:
        return self.build_card(
            text=IdentityMessages.UNLINK_IDENTITY,
            actions=[
                create_action_block(
                    ActionType.OPEN_URL, title=IdentityMessages.UNLINK_IDENTITY_BUTTON, url=self.url
                )
            ],
        )


class MSTeamsLinkCommandMessageBuilder(MSTeamsMessageBuilder):
    def build(self) -> Any:
        return self.build_card(
            text=IdentityMessages.LINK_COMMAND_MESSAGE,
        )


class MSTeamsAlreadyLinkedMessageBuilder(MSTeamsMessageBuilder):
    def build(self) -> Any:
        return self.build_card(text=IdentityMessages.ALREADY_LINKED)
