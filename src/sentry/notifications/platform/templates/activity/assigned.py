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


def get_assignee_text(data: AssignedNotificationData) -> str:
    if not data.activity_data:
        return "someone"

    assignee_type = data.activity_data.get("assigneeType")
    if assignee_type == "team":
        return f"the #{data.assignee_label} team" if data.assignee_label else "a team"
    else:
        return data.assignee_label if data.assignee_label else "someone"


def get_assigned_subject(data: AssignedNotificationData) -> list[NotificationTextBlock]:
    assignee_text = get_assignee_text(data)
    blocks: list[NotificationTextBlock] = [
        CodeTextBlock(text=data.issue_short_id if data.issue_short_id else "An Issue"),
        PlainTextBlock(text=f"was assigned to {assignee_text}"),
    ]
    if data.activity_user_name:
        blocks.append(PlainTextBlock(text=f"by {data.activity_user_name}"))
    return blocks


def get_assigned_body_blocks(data: AssignedNotificationData) -> list[NotificationTextBlock]:
    assignee_text = get_assignee_text(data)
    body_blocks: list[NotificationTextBlock] = [
        build_issue_link(data.issue_short_id, data.issue_url)
    ]
    if data.assignee_url:
        body_blocks.extend(
            [
                PlainTextBlock(text="has been assigned to"),
                LinkTextBlock(text=assignee_text, url=data.assignee_url),
            ]
        )
    else:
        body_blocks.append(PlainTextBlock(text=f"has been assigned to {assignee_text}."))
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
