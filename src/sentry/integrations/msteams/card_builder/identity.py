from sentry.integrations.msteams.card_builder.base.base import (
    ActionType,
    MSTeamsMessageBuilder,
    TextSize,
)
from sentry.utils.types import Any

LINK_IDENTITY_BUTTON = "Link Identities"
LINK_IDENTITY = "You need to link your Microsoft Teams account to your Sentry account before you can take action through Teams messages. Please click here to do so."

LINK_COMMAND_MESSAGE = "Your Microsoft Teams identity will be linked to your Sentry account when you interact with alerts from Sentry."

IDENTITY_LINKED = (
    "Your Microsoft Teams identity has been linked to your Sentry account. You're good to go."
)

ALREADY_LINKED = "Your Microsoft Teams identity is already linked to a Sentry account."

UNLINK_IDENTITY_BUTTON = "Unlink Identity"
UNLINK_IDENTITY = "Click below to unlink your identity"

IDENTITY_UNLINKED = "Your Microsoft Teams identity has been unlinked to your Sentry account. You will need to re-link if you want to interact with messages again."


class MSTeamsUnlinkedMessageBuilder(MSTeamsMessageBuilder):
    def build(self) -> Any:
        return self._build(text=self.get_text_block(IDENTITY_UNLINKED))


class MSTeamsLinkedMessageBuilder(MSTeamsMessageBuilder):
    def build(self) -> Any:
        return self._build(
            text=self.get_column_set_block(
                self.get_column_block(self.get_logo_block()),
                self.get_column_block(
                    self.get_text_block(
                        IDENTITY_LINKED,
                        size=TextSize.LARGE,
                    )
                ),
            )
        )


class MSTeamsLinkIdentityMessageBuilder(MSTeamsMessageBuilder):
    def __init__(self, url):
        self.url = url

    def build(self) -> Any:
        return self._build(
            text=self.get_text_block(LINK_IDENTITY, size=TextSize.MEDIUM),
            actions=[
                self.get_action_block(ActionType.OPEN_URL, title=LINK_IDENTITY_BUTTON, url=self.url)
            ],
        )


class MSTeamsUnlinkIdentityMessageBuilder(MSTeamsMessageBuilder):
    def __init__(self, url):
        self.url = url

    def build(self) -> Any:
        return self._build(
            text=self.get_text_block(UNLINK_IDENTITY),
            actions=[
                self.get_action_block(
                    ActionType.OPEN_URL, title=UNLINK_IDENTITY_BUTTON, url=self.url
                )
            ],
        )


class MSTeamsLinkCommandMessageBuilder(MSTeamsMessageBuilder):
    def build(self) -> Any:
        return self._build(
            text=self.get_text_block(LINK_COMMAND_MESSAGE),
        )


class MSTeamsAlreadyLinkedMessageBuilder(MSTeamsMessageBuilder):
    def build(self) -> Any:
        return self._build(text=self.get_text_block(ALREADY_LINKED))
