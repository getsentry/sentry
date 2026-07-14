from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.activity.base import (
    ActivityAlertActionData,
    create_activity_alert_example,
)
from sentry.notifications.platform.templates.activity.seer.base import (
    build_template,
    get_issue_description,
    get_subject,
)
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationTemplate,
)
from sentry.types.activity import ActivityType


@template_registry.register(NotificationSource.ACTIVITY_SEER_ITERATION_STARTED)
class SeerIterationStartedActivityTemplate(NotificationTemplate[ActivityAlertActionData]):
    category = NotificationCategory.ACTIVITY
    example_data = create_activity_alert_example(ActivityType.SEER_ITERATION_STARTED)

    def render(self, data: ActivityAlertActionData) -> NotificationRenderedTemplate:
        return build_template(
            data=data,
            subject=get_subject("PR Iteration Started", data),
            body=get_issue_description(data),
        )
