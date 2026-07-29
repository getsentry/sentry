from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.activity.base import (
    ActivityNotificationData,
    build_footer,
    build_issue_link,
    create_activity_notification_example,
    get_issue_description,
)
from sentry.notifications.platform.types import (
    BlockQuoteSection,
    CodeTextBlock,
    NotificationCategory,
    NotificationRenderedTemplate,
    NotificationSection,
    NotificationSource,
    NotificationTemplate,
    NotificationTextBlock,
    ParagraphSection,
    PlainTextBlock,
)
from sentry.types.activity import ActivityType


def get_note_subject(data: ActivityNotificationData) -> list[NotificationTextBlock]:
    blocks: list[NotificationTextBlock] = []
    blocks.append(PlainTextBlock(text="New comment on"))
    if data.issue_short_id:
        blocks.append(CodeTextBlock(text=data.issue_short_id))
    else:
        blocks.append(PlainTextBlock(text="a Sentry Issue"))
    if data.activity_user_name:
        blocks.append(PlainTextBlock(text=f"by {data.activity_user_name}"))
    return blocks


def get_note_body(data: ActivityNotificationData) -> list[NotificationSection]:
    if not data.activity_data:
        return []
    text = data.activity_data.get("text")
    if not text:
        return []
    return [BlockQuoteSection(blocks=[PlainTextBlock(text=str(text))])]


@template_registry.register(NotificationSource.ACTIVITY_NOTE)
class NoteActivityTemplate(NotificationTemplate[ActivityNotificationData]):
    category = NotificationCategory.ACTIVITY
    example_data = create_activity_notification_example(
        ActivityType.NOTE,
        activity_data={"text": "This looks like it might be related to the auth migration."},
    )

    def render(self, data: ActivityNotificationData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject=get_note_subject(data),
            body=[
                ParagraphSection(
                    blocks=[
                        build_issue_link(data.issue_short_id, data.issue_url),
                        PlainTextBlock(text="has a new comment."),
                    ]
                ),
                *get_note_body(data),
                *get_issue_description(data=data),
            ],
            footer=build_footer(data=data),
        )
