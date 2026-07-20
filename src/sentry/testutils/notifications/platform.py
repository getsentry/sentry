from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.types import (
    BlockQuoteSection,
    BoldTextBlock,
    CodeSection,
    CodeTextBlock,
    ItalicTextBlock,
    LinkTextBlock,
    NotificationCategory,
    NotificationData,
    NotificationRenderedAction,
    NotificationRenderedImage,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationStrategy,
    NotificationTarget,
    NotificationTemplate,
    ParagraphSection,
    PlainTextBlock,
)


class MockNotification(NotificationData):
    source: NotificationSource = NotificationSource.TEST
    message: str


@template_registry.register(NotificationSource.TEST)
class MockNotificationTemplate(NotificationTemplate[MockNotification]):
    category = NotificationCategory.DEBUG
    example_data = MockNotification(message="This is a mock notification")

    def render(self, data: MockNotification) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject=[
                PlainTextBlock(text="Alert:"),
                ItalicTextBlock(text="Mock Notification"),
            ],
            body=[
                ParagraphSection(
                    blocks=[
                        PlainTextBlock(text=data.message),
                        BoldTextBlock(text="important"),
                        ItalicTextBlock(text="urgent"),
                        LinkTextBlock(text="View Issue", url="https://sentry.io/issue/1"),
                    ]
                ),
                CodeSection(blocks=[PlainTextBlock(text="raise Exception('test')")]),
                BlockQuoteSection(blocks=[PlainTextBlock(text="This is a quoted message")]),
            ],
            actions=[
                NotificationRenderedAction(label="Visit Sentry", link="https://www.sentry.io")
            ],
            chart=NotificationRenderedImage(
                url="https://raw.githubusercontent.com/knobiknows/all-the-bufo/main/all-the-bufo/bufo-pog.png",
                alt_text="Bufo Pog",
            ),
            footer=[
                PlainTextBlock(text="Sent via"),
                CodeTextBlock(text="sentry-alerts"),
            ],
        )


class MockStrategy(NotificationStrategy):
    def __init__(self, *, targets: list[NotificationTarget]):
        self.targets = targets

    def get_targets(self) -> list[NotificationTarget]:
        return self.targets
