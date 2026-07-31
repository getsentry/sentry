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
    NotificationCategory,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationTemplate,
)
from sentry.types.activity import ActivityType


@template_registry.register(NotificationSource.ACTIVITY_SEER_SOLUTION_STARTED)
class SeerSolutionStartedActivityTemplate(NotificationTemplate[ActivityNotificationData]):
    category = NotificationCategory.ACTIVITY
    example_data = create_activity_notification_example(ActivityType.SEER_SOLUTION_STARTED)

    def render(self, data: ActivityNotificationData) -> NotificationRenderedTemplate:
        return build_template(
            data=data,
            subject=get_subject("Planning Started", data),
            body=get_issue_description(data),
        )
