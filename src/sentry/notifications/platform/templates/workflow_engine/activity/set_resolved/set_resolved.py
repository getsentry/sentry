from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.workflow_engine.activity.base import (
    ActivityAlertActionData,
    build_alert_footer,
    build_issue_link,
    create_activity_alert_example,
)
from sentry.notifications.platform.templates.workflow_engine.activity.set_resolved.base import (
    get_resolution_subject,
)
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationTemplate,
    ParagraphSection,
    PlainTextBlock,
)
from sentry.types.activity import ActivityType


@template_registry.register(NotificationSource.ACTIVITY_SET_RESOLVED)
class SetResolvedActivityTemplate(NotificationTemplate[ActivityAlertActionData]):
    category = NotificationCategory.ALERTS
    example_data = create_activity_alert_example(ActivityType.SET_RESOLVED)

    def render(self, data: ActivityAlertActionData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject=get_resolution_subject(data),
            body=[
                ParagraphSection(
                    blocks=[
                        build_issue_link(data.issue_short_id, data.issue_url),
                        PlainTextBlock(text="had its status changed to resolved."),
                    ]
                )
            ],
            footer=build_alert_footer(alert_url=data.alert_url),
        )
