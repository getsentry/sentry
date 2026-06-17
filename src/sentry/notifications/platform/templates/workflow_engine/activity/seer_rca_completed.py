from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.workflow_engine.activity.seer_base import (
    WorkflowEngineActivityAction,
    build_template,
    extract_models,
    get_example_issue_description,
    get_example_template,
    get_issue_description,
    get_seer_link,
)
from sentry.notifications.platform.types import (
    CodeBlock,
    NotificationCategory,
    NotificationRenderedAction,
    NotificationRenderedTemplate,
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
            subject="Seer found the root cause",
            body=[
                CodeBlock(
                    blocks=[
                        PlainTextBlock(
                            text="The error is caused by a null pointer dereference in the user authentication flow."
                        )
                    ]
                ),
                get_example_issue_description(),
            ],
        )

    def render(self, data: WorkflowEngineActivityAction) -> NotificationRenderedTemplate:
        activity, group, project, organization = extract_models(data)
        fallback = "Click the link below to view the details in Sentry"
        summary_block = PlainTextBlock(text=activity.data.get("summary", fallback))
        return build_template(
            data=data,
            subject="Seer found the root cause",
            body=[CodeBlock(blocks=[summary_block]), get_issue_description(group)],
            extra_actions=[
                NotificationRenderedAction(label="View in Sentry", link=get_seer_link(group))
            ],
        )
