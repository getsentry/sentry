from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.activity.base import (
    SetResolvedInCommitNotificationData,
    build_footer,
    build_issue_link,
    create_activity_notification_example,
    get_issue_description,
)
from sentry.notifications.platform.templates.activity.status_change.base import (
    get_status_change_subject,
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


def create_set_resolved_in_commit_example() -> SetResolvedInCommitNotificationData:
    action_data = create_activity_notification_example(ActivityType.SET_RESOLVED_IN_COMMIT)
    return SetResolvedInCommitNotificationData(
        **action_data.dict(),
        commit_sha="abc1234",
        commit_message="Fix null pointer dereference in auth flow",
    )


@template_registry.register(NotificationSource.ACTIVITY_SET_RESOLVED_IN_COMMIT)
class SetResolvedInCommitActivityTemplate(
    NotificationTemplate[SetResolvedInCommitNotificationData]
):
    category = NotificationCategory.ACTIVITY
    example_data = create_set_resolved_in_commit_example()

    def render(self, data: SetResolvedInCommitNotificationData) -> NotificationRenderedTemplate:
        extra_body_sections: list[NotificationSection] = get_issue_description(data=data)
        resolution_blocks: list[NotificationTextBlock] = [
            PlainTextBlock(text="was resolved in a commit.")
        ]
        if data.commit_sha:
            resolution_blocks = [
                PlainTextBlock(text="was resolved in commit"),
                CodeTextBlock(text=data.commit_sha),
            ]
            if data.commit_message:
                extra_body_sections.insert(
                    0, BlockQuoteSection(blocks=[PlainTextBlock(text=data.commit_message)])
                )

        return NotificationRenderedTemplate(
            subject=get_status_change_subject(data),
            body=[
                ParagraphSection(
                    blocks=[
                        build_issue_link(data.issue_short_id, data.issue_url),
                        *resolution_blocks,
                    ],
                ),
                *extra_body_sections,
            ],
            footer=build_footer(data=data),
        )
