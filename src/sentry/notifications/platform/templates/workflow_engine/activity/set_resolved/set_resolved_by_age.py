from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.workflow_engine.activity.base import (
    WorkflowEngineActivityAction,
    build_alert_footer,
)
from sentry.notifications.platform.templates.workflow_engine.activity.set_resolved.base import (
    get_example_resolution_issue_label,
    get_resolution_issue_label,
    get_resolution_subject,
    render_resolution_example,
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
from sentry.utils.dates import format_duration


@template_registry.register(NotificationSource.ACTIVITY_SET_RESOLVED_BY_AGE)
class SetResolvedByAgeActivityTemplate(NotificationTemplate[WorkflowEngineActivityAction]):
    category = NotificationCategory.WORKFLOW_ENGINE
    example_data = WorkflowEngineActivityAction(
        source=NotificationSource.ACTIVITY_SET_RESOLVED_BY_AGE,
        notification_uuid="1234567890",
        workflow_id=1,
        activity_type=ActivityType.SET_RESOLVED_BY_AGE.value,
        activity_id=1,
        detector_id=1,
    )

    def render_example(self) -> NotificationRenderedTemplate:
        return render_resolution_example(
            body=[
                ParagraphSection(
                    blocks=[
                        get_example_resolution_issue_label(),
                        PlainTextBlock(
                            text="was resolved automatically after 7 days of inactivity."
                        ),
                    ]
                ),
            ]
        )

    def render(self, data: WorkflowEngineActivityAction) -> NotificationRenderedTemplate:
        from sentry.notifications.notification_action.activity_registry.base import (
            extract_notification_models_by_activity,
        )

        activity, group, project, organization = extract_notification_models_by_activity(
            activity_id=data.activity_id
        )
        resolution_text = "was resolved automatically due to inactivity."
        if activity.data and "age" in activity.data:
            duration = format_duration(int(activity.data["age"]) * 60)
            resolution_text = f"was resolved automatically after {duration} of inactivity."

        return NotificationRenderedTemplate(
            subject=get_resolution_subject(activity, group),
            body=[
                ParagraphSection(
                    blocks=[
                        get_resolution_issue_label(group),
                        PlainTextBlock(text=resolution_text),
                    ]
                )
            ],
            footer=build_alert_footer(organization=organization, workflow_id=data.workflow_id),
        )
