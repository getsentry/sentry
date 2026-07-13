from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.workflow_engine.activity.base import (
    ActivityAlertActionData,
    create_activity_alert_example,
)
from sentry.notifications.platform.templates.workflow_engine.activity.seer.base import (
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


@template_registry.register(NotificationSource.ACTIVITY_SEER_SOLUTION_STARTED)
class SeerSolutionStartedActivityTemplate(NotificationTemplate[ActivityAlertActionData]):
    category = NotificationCategory.ALERTS
    example_data = create_activity_alert_example(ActivityType.SEER_SOLUTION_STARTED)

    def render(self, data: ActivityAlertActionData) -> NotificationRenderedTemplate:
        return build_template(
            data=data,
            subject=get_subject("Planning Started", data),
            body=get_issue_description(data),
        )
