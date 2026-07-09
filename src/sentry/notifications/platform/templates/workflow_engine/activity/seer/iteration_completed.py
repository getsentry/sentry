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
    LinkTextBlock,
    NotificationCategory,
    NotificationRenderedTemplate,
    NotificationSection,
    NotificationSource,
    NotificationTemplate,
    NotificationTextBlock,
    ParagraphSection,
    PlainTextBlock,
)
from sentry.types.activity import ActivityType


@template_registry.register(NotificationSource.ACTIVITY_SEER_ITERATION_COMPLETED)
class SeerIterationCompletedActivityTemplate(NotificationTemplate[ActivityAlertAction]):
    category = NotificationCategory.ALERTS
    example_data = ActivityAlertAction(
        source=NotificationSource.ACTIVITY_SEER_ITERATION_COMPLETED,
        notification_uuid="1234567890",
        workflow_id=1,
        activity_type=ActivityType.SEER_ITERATION_COMPLETED.value,
        activity_id=1,
        detector_id=1,
    )

    def render_example(self) -> NotificationRenderedTemplate:
        return get_example_template(
            subject="Seer PR Iteration Completed for EXAMPLE-1",
            body=[
                *get_example_issue_description(),
                ParagraphSection(
                    blocks=[
                        PlainTextBlock(text="Iteration #2: "),
                        LinkTextBlock(
                            text="owner/repo (#42)",
                            url="https://github.com/owner/repo/pull/42",
                        ),
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

        body: list[NotificationSection] = [*get_issue_description(group)]

        if activity.data:
            detail_blocks: list[NotificationTextBlock] = []

            iteration_index = activity.data.get("iteration_index")
            if iteration_index is not None:
                prefix = f"Iteration #{iteration_index}"
            else:
                prefix = "Iteration"

            for pull_request in activity.data.get("pull_requests", []):
                repo_name = pull_request.get("repo_name", "")
                pr_url = pull_request.get("pull_request", {}).get("pr_url")
                pr_number = pull_request.get("pull_request", {}).get("pr_number")
                if pr_url:
                    label = f"{repo_name} (#{pr_number})" if pr_number else repo_name
                    detail_blocks.append(
                        PlainTextBlock(text=f"{prefix}: " if not detail_blocks else ", ")
                    )
                    detail_blocks.append(LinkTextBlock(text=label, url=pr_url))

            if not detail_blocks:
                detail_blocks.append(PlainTextBlock(text=prefix))

            body.append(ParagraphSection(blocks=detail_blocks))

        return build_template(
            data=data,
            subject=get_subject("PR Iteration Completed", group),
            body=body,
        )
