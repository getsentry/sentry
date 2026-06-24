from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.workflow_engine.activity.seer_base import (
    WorkflowEngineActivityAction,
    build_template,
    extract_models,
    get_example_issue_description,
    get_example_template,
    get_issue_description,
    get_subject,
    get_view_in_sentry_button,
)
from sentry.notifications.platform.types import (
    CodeBlock,
    NotificationBodyFormattingBlock,
    NotificationCategory,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationTemplate,
    PlainTextBlock,
)
from sentry.types.activity import ActivityType


@template_registry.register(NotificationSource.ACTIVITY_SEER_SOLUTION_COMPLETED)
class SeerSolutionCompletedActivityTemplate(NotificationTemplate[WorkflowEngineActivityAction]):
    category = NotificationCategory.WORKFLOW_ENGINE
    example_data = WorkflowEngineActivityAction(
        source=NotificationSource.ACTIVITY_SEER_SOLUTION_COMPLETED,
        notification_uuid="1234567890",
        workflow_id=1,
        activity_type=ActivityType.SEER_SOLUTION_COMPLETED.value,
        activity_id=1,
        detector_id=1,
    )

    def render_example(self) -> NotificationRenderedTemplate:
        return get_example_template(
            subject="Seer Solution Completed for EXAMPLE-1",
            body=[
                *get_example_issue_description(),
                CodeBlock(
                    blocks=[
                        PlainTextBlock(
                            text="Add a null check before accessing user.session in the authentication middleware."
                        )
                    ]
                ),
            ],
        )

    def render(self, data: WorkflowEngineActivityAction) -> NotificationRenderedTemplate:
        activity, group, project, organization = extract_models(data)
        fallback = "View the details in Sentry."
        body: list[NotificationBodyFormattingBlock] = [
            *get_issue_description(group),
        ]
        if activity.data:
            summary_block = PlainTextBlock(text=activity.data.get("summary", fallback))
            body.append(CodeBlock(blocks=[summary_block]))
        return build_template(
            data=data,
            subject=get_subject("Seer Solution Completed", group),
            body=body,
            extra_actions=[get_view_in_sentry_button(group)],
        )
