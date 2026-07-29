from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.activity.base import (
    ActivityNotificationData,
    build_footer,
    build_issue_link,
    create_activity_notification_example,
    get_issue_description,
)
from sentry.notifications.platform.types import (
    CodeTextBlock,
    NotificationCategory,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationTemplate,
    NotificationTextBlock,
    ParagraphSection,
    PlainTextBlock,
)
from sentry.types.activity import ActivityType


def get_unassigned_subject(data: ActivityNotificationData) -> list[NotificationTextBlock]:
    blocks: list[NotificationTextBlock] = []
    if data.issue_short_id:
        blocks.append(CodeTextBlock(text=data.issue_short_id))
    else:
        blocks.append(PlainTextBlock(text="An Issue"))
    blocks.append(PlainTextBlock(text="was unassigned"))
    if data.activity_user_name:
        blocks.append(PlainTextBlock(text=f"by {data.activity_user_name}"))
    return blocks


@template_registry.register(NotificationSource.ACTIVITY_UNASSIGNED)
class UnassignedActivityTemplate(NotificationTemplate[ActivityNotificationData]):
    category = NotificationCategory.ACTIVITY
    example_data = create_activity_notification_example(ActivityType.UNASSIGNED)

    def render(self, data: ActivityNotificationData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject=get_unassigned_subject(data),
            body=[
                ParagraphSection(
                    blocks=[
                        build_issue_link(data.issue_short_id, data.issue_url),
                        PlainTextBlock(text="is no longer assigned to anyone."),
                    ]
                ),
                *get_issue_description(data=data),
            ],
            footer=build_footer(data=data),
        )
