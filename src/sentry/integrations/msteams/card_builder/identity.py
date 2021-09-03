from sentry.integrations.msteams.card_builder.base.block import BlockMSTeamsMessageBuilder, TextSize
from sentry.utils.types import Any


class MSTeamsUnlinkedMessageBuilder(BlockMSTeamsMessageBuilder):
    def build(self) -> Any:
        return self._build(
            text=self.get_text_block(
                "Your Microsoft Teams identity has been unlinked to your Sentry account."
                " You will need to re-link if you want to interact with messages again."
            )
        )


class MSTeamsLinkedMessageBuilder(BlockMSTeamsMessageBuilder):
    def build(self) -> Any:
        return self._build(
            text=self.get_column_block(
                self.get_logo_block(),
                self.get_text_block(
                    "Your Microsoft Teams identity has been linked to your Sentry account. You're good to go.",
                    size=TextSize.LARGE,
                ),
            )
        )
