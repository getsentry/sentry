from dataclasses import dataclass
from datetime import datetime

from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.types import NotificationTemplateSource
from sentry.notifications.platform.types import (
    CodeBlock,
    NotificationCategory,
    NotificationData,
    NotificationRenderedAction,
    NotificationRenderedTemplate,
    NotificationTemplate,
    ParagraphBlock,
    PlainTextBlock,
)


def format_datetime(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S")


@dataclass(frozen=True)
class CustomRuleSamplesFulfilled(NotificationData):
    source = NotificationTemplateSource.CUSTOM_RULE_SAMPLES_FULFILLED
    query: str | None
    num_samples: int
    start_date: datetime
    end_date: datetime
    discover_link: str


@template_registry.register(CustomRuleSamplesFulfilled.source)
class CustomRuleSamplesFulfilledTemplate(NotificationTemplate[CustomRuleSamplesFulfilled]):
    category = NotificationCategory.DYNAMIC_SAMPLING
    example_data = CustomRuleSamplesFulfilled(
        query="transaction.duration:>1s",
        num_samples=100,
        start_date=datetime(2024, 1, 1, 0, 0, 0),
        end_date=datetime(2024, 1, 31, 23, 59, 59),
        discover_link="https://sentry.io/discover",
    )

    def render(self, data: CustomRuleSamplesFulfilled) -> NotificationRenderedTemplate:
        query_text = data.query if data.query else "your custom rule"

        return NotificationRenderedTemplate(
            subject=f"We've collected {data.num_samples} samples for the query: {query_text} you made",
            body=[
                ParagraphBlock(blocks=[PlainTextBlock(text="We have samples!")]),
                ParagraphBlock(
                    blocks=[
                        PlainTextBlock(
                            text=f"We've collected {data.num_samples} samples for your custom sampling rule, from {format_datetime(data.start_date)} to {format_datetime(data.end_date)}, with the query:"
                        )
                    ]
                ),
                CodeBlock(blocks=[PlainTextBlock(text=query_text)]),
                ParagraphBlock(
                    blocks=[
                        PlainTextBlock(
                            text="We'll stop giving special priority to samples for your query once we collected 100 samples matching your query or 48 hours have passed from rule creation."
                        )
                    ]
                ),
            ],
            actions=[NotificationRenderedAction(label="View in Discover", link=data.discover_link)],
        )
