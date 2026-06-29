from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.workflow_engine.activity.seer_base import (
    WorkflowEngineActivityAction,
    build_template,
    get_example_issue_description,
    get_example_template,
    get_issue_description,
    get_subject,
    get_view_in_sentry_button,
)
from sentry.notifications.platform.types import (
    CodeBlock,
    NotificationCategory,
    NotificationRenderedTemplate,
    NotificationSection,
    NotificationSource,
    NotificationTemplate,
    PlainTextBlock,
)
from sentry.types.activity import ActivityType


@template_registry.register(NotificationSource.ACTIVITY_SEER_RCA_COMPLETED)
class SeerRcaCompletedActivityTemplate(NotificationTemplate[WorkflowEngineActivityAction]):
    category = NotificationCategory.WORKFLOW_ENGINE
    example_data = WorkflowEngineActivityAction(
        source=NotificationSource.ACTIVITY_SEER_RCA_COMPLETED,
        notification_uuid="1234567890",
        workflow_id=1,
        activity_type=ActivityType.SEER_RCA_COMPLETED.value,
        activity_id=1,
        detector_id=1,
    )

    def render_example(self) -> NotificationRenderedTemplate:
        return get_example_template(
            subject="Seer RCA Completed for EXAMPLE-1",
            body=[
                *get_example_issue_description(),
                CodeBlock(
                    blocks=[
                        PlainTextBlock(
                            text="The error is caused by a null pointer dereference in the user authentication flow."
                        )
                    ]
                ),
            ],
        )

    def render(self, data: WorkflowEngineActivityAction) -> NotificationRenderedTemplate:
        from sentry.notifications.notification_action.activity_registry.base import (
            extract_notification_models_by_activity,
        )

        activity, group, project, organization = extract_notification_models_by_activity(
            activity_id=data.activity_id
        )
        fallback = "View the details in Sentry."
        body: list[NotificationSection] = [*get_issue_description(group)]
        if activity.data:
            summary_block = PlainTextBlock(text=activity.data.get("summary", fallback))
            body.append(CodeBlock(blocks=[summary_block]))
        return build_template(
            data=data,
            subject=get_subject("Seer RCA Completed", group),
            body=body,
            extra_actions=[get_view_in_sentry_button(group)],
        )
