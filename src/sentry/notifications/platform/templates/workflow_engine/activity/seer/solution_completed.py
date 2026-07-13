from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.workflow_engine.activity.base import (
    ActivityAlertAction,
)
from sentry.notifications.platform.templates.workflow_engine.activity.seer.base import (
    build_template,
    get_example_issue_description,
    get_example_template,
    get_issue_description,
    get_subject,
)
from sentry.notifications.platform.types import (
    BlockQuoteSection,
    ItalicTextBlock,
    NotificationCategory,
    NotificationRenderedTemplate,
    NotificationSection,
    NotificationSource,
    NotificationTemplate,
)
from sentry.types.activity import ActivityType


@template_registry.register(NotificationSource.ACTIVITY_SEER_SOLUTION_COMPLETED)
class SeerSolutionCompletedActivityTemplate(NotificationTemplate[ActivityAlertAction]):
    category = NotificationCategory.ALERTS
    example_data = ActivityAlertAction(
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
                BlockQuoteSection(
                    blocks=[
                        ItalicTextBlock(
                            text="Add a null check before accessing user.session in the authentication middleware."
                        )
                    ]
                ),
            ],
        )

    def render(self, data: ActivityAlertAction) -> NotificationRenderedTemplate:
        from sentry.notifications.notification_action.activity_registry.base import (
            extract_notification_models_by_activity,
        )

        activity, group, project, organization = extract_notification_models_by_activity(
            activity_id=data.activity_id
        )
        fallback = "View the details in Sentry."
        body: list[NotificationSection] = [*get_issue_description(group)]
        if activity.data:
            summary_block = ItalicTextBlock(text=activity.data.get("summary", fallback))
            body.append(BlockQuoteSection(blocks=[summary_block]))
        return build_template(
            data=data,
            subject=get_subject("Planning Completed", group),
            body=body,
        )
