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
    NotificationCategory,
    NotificationRenderedAction,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationTemplate,
    ParagraphBlock,
    PlainTextBlock,
)
from sentry.types.activity import ActivityType


@template_registry.register(NotificationSource.ACTIVITY_SEER_CODING_COMPLETED)
class SeerCodingCompletedActivityTemplate(NotificationTemplate[WorkflowEngineActivityAction]):
    category = NotificationCategory.WORKFLOW_ENGINE
    example_data = WorkflowEngineActivityAction(
        source=NotificationSource.ACTIVITY_SEER_CODING_COMPLETED,
        notification_uuid="1234567890",
        workflow_id=1,
        activity_type=ActivityType.SEER_CODING_COMPLETED.value,
        activity_id=1,
        detector_id=1,
    )

    def render_example(self) -> NotificationRenderedTemplate:
        return get_example_template(
            subject="Seer's code changes are prepared",
            body=[
                ParagraphBlock(
                    blocks=[
                        PlainTextBlock(
                            text="You can check out the Seer's suggested diff in Sentry."
                        )
                    ]
                ),
                get_example_issue_description(),
            ],
        )

    def render(self, data: WorkflowEngineActivityAction) -> NotificationRenderedTemplate:
        activity, group, project, organization = extract_models(data)
        text_block = PlainTextBlock(text="You can check out the Seer's suggested diff in Sentry.")
        return build_template(
            data=data,
            subject="Seer's code changes are prepared",
            body=[ParagraphBlock(blocks=[text_block]), get_issue_description(group)],
            extra_actions=[
                NotificationRenderedAction(label="View in Sentry", link=get_seer_link(group))
            ],
        )
