from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.base.base import SlackMessageBuilder


class SlackLinkMessageBuilder(SlackMessageBuilder):
    def build(self) -> SlackBody:
        return self._build(
            color="error",
            fallback="MARCOS",
            fields=[],
            footer="footer",
            text="text",
            title="title",
            title_link="title_link",
        )
