from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.workflow_engine.activity.base import (
    ActivityAlertAction,
)
from sentry.notifications.platform.templates.workflow_engine.activity.seer.base import (
    build_template,
    get_example_template,
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


@template_registry.register(NotificationSource.ACTIVITY_SEER_CODING_STARTED)
class SeerCodingStartedActivityTemplate(NotificationTemplate[ActivityAlertAction]):
    category = NotificationCategory.ALERTS
    example_data = ActivityAlertAction(
        source=NotificationSource.ACTIVITY_SEER_CODING_STARTED,
        notification_uuid="1234567890",
        workflow_id=1,
        activity_type=ActivityType.SEER_CODING_STARTED.value,
        activity_id=1,
        detector_id=1,
    )

    def render_example(self) -> NotificationRenderedTemplate:
        return get_example_template("Seer Coding Started for EXAMPLE-1")

    def render(self, data: ActivityAlertAction) -> NotificationRenderedTemplate:
        from sentry.notifications.notification_action.activity_registry.base import (
            extract_notification_models_by_activity,
        )

        activity, group, project, organization = extract_notification_models_by_activity(
            activity_id=data.activity_id
        )
        return build_template(
            data=data,
            subject=get_subject("Coding Started", group),
            body=get_issue_description(group),
        )
