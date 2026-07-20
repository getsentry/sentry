from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.activity.base import (
    ActivityNotificationData,
    create_activity_notification_example,
    get_issue_description,
)
from sentry.notifications.platform.templates.activity.seer.base import (
    build_template,
    get_subject,
)
from sentry.notifications.platform.types import (
    BlockQuoteSection,
    ItalicTextBlock,
    NotificationCategory,
    NotificationRenderedTemplate,
    NotificationSection,
    NotificationSource,
    NotificationTemplate,
)
from sentry.types.activity import ActivityType


@template_registry.register(NotificationSource.ACTIVITY_SEER_SOLUTION_COMPLETED)
class SeerSolutionCompletedActivityTemplate(NotificationTemplate[ActivityNotificationData]):
    category = NotificationCategory.ACTIVITY
    example_data = create_activity_notification_example(
        ActivityType.SEER_SOLUTION_COMPLETED,
        activity_data={
            "summary": "Add a null check before accessing user.session in the authentication middleware."
        },
    )

    def render(self, data: ActivityNotificationData) -> NotificationRenderedTemplate:
        fallback = "View the details in Sentry."
        body: list[NotificationSection] = [*get_issue_description(data)]
        if data.activity_data:
            summary_block = ItalicTextBlock(text=data.activity_data.get("summary", fallback))
            body.append(BlockQuoteSection(blocks=[summary_block]))
        return build_template(
            data=data,
            subject=get_subject("Planning Completed", data),
            body=body,
        )
