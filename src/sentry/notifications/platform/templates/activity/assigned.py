from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.activity.base import (
    AssignedNotificationData,
    build_footer,
    build_issue_link,
    create_activity_notification_example,
    get_issue_description,
)
from sentry.notifications.platform.types import (
    CodeTextBlock,
    LinkTextBlock,
    NotificationCategory,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationTemplate,
    NotificationTextBlock,
    ParagraphSection,
    PlainTextBlock,
)
from sentry.types.activity import ActivityType


def get_assignee_label(data: AssignedNotificationData) -> str:
    return (
        data.activity_user_name or "a user"
        if data.assignee_label == "themselves"
        else data.assignee_label
    )


def get_assigned_subject(data: AssignedNotificationData) -> list[NotificationTextBlock]:
    blocks: list[NotificationTextBlock] = []
    if data.issue_short_id:
        blocks.append(CodeTextBlock(text=data.issue_short_id))
    else:
        blocks.append(PlainTextBlock(text="An Issue"))
    blocks.append(PlainTextBlock(text=f"was assigned to {get_assignee_label(data)}"))
    by_display = (
        data.assignee_label if data.assignee_label == "themselves" else data.activity_user_name
    )
    if by_display:
        blocks.append(PlainTextBlock(text=f"by {by_display}"))
    return blocks


def get_assigned_body_blocks(data: AssignedNotificationData) -> list[NotificationTextBlock]:
    body_blocks: list[NotificationTextBlock] = [
        build_issue_link(data.issue_short_id, data.issue_url)
    ]
    if data.assignee_url:
        body_blocks.extend(
            [
                PlainTextBlock(text="has been assigned to"),
                LinkTextBlock(text=get_assignee_label(data), url=data.assignee_url),
            ]
        )
    else:
        body_blocks.append(PlainTextBlock(text=f"has been assigned to {get_assignee_label(data)}."))
    return body_blocks


def create_assigned_example() -> AssignedNotificationData:
    action_data = create_activity_notification_example(
        ActivityType.ASSIGNED,
        activity_data={
            "assignee": "123",
            "assigneeEmail": "john@example.com",
            "assigneeType": "user",
        },
    )
    return AssignedNotificationData(
        **action_data.dict(),
        assignee_label="themselves",
        assignee_url="mailto:example@sentry.io",
    )


@template_registry.register(NotificationSource.ACTIVITY_ASSIGNED)
class AssignedActivityTemplate(NotificationTemplate[AssignedNotificationData]):
    category = NotificationCategory.ACTIVITY
    example_data = create_assigned_example()

    def render(self, data: AssignedNotificationData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject=get_assigned_subject(data),
            body=[
                ParagraphSection(blocks=get_assigned_body_blocks(data=data)),
                *get_issue_description(data=data),
            ],
            footer=build_footer(data=data),
        )
