from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder


class SlackDiscoverMessageBuilder(BlockSlackMessageBuilder):
    def __init__(self, title: str, chart_url: str) -> None:
        super().__init__()
        self.title = title
        self.chart_url = chart_url

    def build(self) -> SlackBody:
        return self._build_blocks(
            self.get_image_block(self.chart_url, title=self.title, alt="Discover Chart")
        )


def build_discover_attachment(title: str, chart_url: str) -> SlackBody:
    """@deprecated"""
    return SlackDiscoverMessageBuilder(title, chart_url).build()
