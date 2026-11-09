from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.types import (
    BoldTextBlock,
    NotificationCategory,
    NotificationData,
    NotificationRenderedAction,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationTemplate,
    ParagraphSection,
    PlainTextBlock,
)


class InboxItemNotificationData(NotificationData):
    source: NotificationSource = NotificationSource.INBOX_ITEM
    inbox_item_id: int
    event_type: str
    subject_title: str
    summary: str
    actor_name: str
    inbox_url: str


@template_registry.register(NotificationSource.INBOX_ITEM)
class InboxItemNotificationTemplate(NotificationTemplate[InboxItemNotificationData]):
    category = NotificationCategory.INBOX
    example_data = InboxItemNotificationData(
        organization_id=1,
        inbox_item_id=1,
        event_type="issue.user_mentioned",
        subject_title="ExampleError: something went wrong",
        summary="Mentioned you in a comment",
        actor_name="Jane Doe",
        inbox_url="https://sentry.io/organizations/acme/inbox/issue/1/",
    )

    def render(self, data: InboxItemNotificationData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject=data.subject_title,
            body=[
                ParagraphSection(
                    blocks=[
                        BoldTextBlock(text=f"{data.actor_name}:"),
                        PlainTextBlock(text=data.summary),
                    ]
                )
            ],
            actions=[NotificationRenderedAction(label="View in Inbox", link=data.inbox_url)],
        )
