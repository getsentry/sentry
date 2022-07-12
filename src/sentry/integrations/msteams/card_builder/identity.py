from typing import Any

from sentry.integrations.msteams.card_builder.base import (
    ActionType,
    MSTeamsMessageBuilder,
    TextSize,
)

from .utils import IdentityMessages


class MSTeamsUnlinkedMessageBuilder(MSTeamsMessageBuilder):
    def build(self) -> Any:
        return self.build_card(text=IdentityMessages.IDENTITY_UNLINKED)


class MSTeamsLinkedMessageBuilder(MSTeamsMessageBuilder):
    def build(self) -> Any:
        return self.build_card(
            text=self.get_column_set_block(
                self.get_logo_block(),
                self.get_text_block(
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
            text=self.get_text_block(IdentityMessages.LINK_IDENTITY, size=TextSize.MEDIUM),
            actions=[
                self.get_action_block(
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
                self.get_action_block(
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
