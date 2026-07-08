from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.workflow_engine.activity.base import (
    WorkflowEngineActivityAction,
    build_alert_footer,
    build_example_alert_footer,
)
from sentry.notifications.platform.templates.workflow_engine.activity.set_resolved.base import (
    get_example_resolution_issue_label,
    get_example_resolution_subject,
    get_resolution_issue_label,
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
class SetResolvedActivityTemplate(NotificationTemplate[WorkflowEngineActivityAction]):
    category = NotificationCategory.WORKFLOW_ENGINE
    example_data = WorkflowEngineActivityAction(
        source=NotificationSource.ACTIVITY_SET_RESOLVED,
        notification_uuid="1234567890",
        workflow_id=1,
        activity_type=ActivityType.SET_RESOLVED.value,
        activity_id=1,
        detector_id=1,
    )

    def render_example(self) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject=get_example_resolution_subject(),
            body=[
                ParagraphSection(
                    blocks=[
                        get_example_resolution_issue_label(),
                        PlainTextBlock(text="had its status changed to resolved."),
                    ]
                )
            ],
            footer=build_example_alert_footer(),
        )

    def render(self, data: WorkflowEngineActivityAction) -> NotificationRenderedTemplate:
        from sentry.notifications.notification_action.activity_registry.base import (
            extract_notification_models_by_activity,
        )

        activity, group, project, organization = extract_notification_models_by_activity(
            activity_id=data.activity_id
        )
        return NotificationRenderedTemplate(
            subject=get_resolution_subject(activity, group),
            body=[
                ParagraphSection(
                    blocks=[
                        get_resolution_issue_label(group),
                        PlainTextBlock(text="had its status changed to resolved."),
                    ]
                )
            ],
            footer=build_alert_footer(organization=organization, workflow_id=data.workflow_id),
        )
