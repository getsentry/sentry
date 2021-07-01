from sentry.features.helpers import any_organization_has_feature
from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.help import SlackHelpMessageBuilder
from sentry.models import Integration

EVENT_MESSAGE = (
    "Want to learn more about configuring alerts in Sentry? Check out our documentation."
)


class SlackEventMessageBuilder(SlackHelpMessageBuilder):
    def __init__(self, integration: Integration) -> None:
        super().__init__()
        self.integration = integration

    def build(self) -> SlackBody:
        if not any_organization_has_feature(
            "organizations:notification-platform", self.integration.organizations.all()
        ):
            return self._build_blocks(
                self.get_markdown_block(EVENT_MESSAGE),
                self.get_docs_block(),
            )

        return super().build()
