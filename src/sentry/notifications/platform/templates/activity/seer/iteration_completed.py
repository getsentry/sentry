from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.activity.base import (
    ActivityNotificationData,
    create_activity_notification_example,
    get_issue_description,
)
from sentry.notifications.platform.templates.activity.seer.base import (
    build_template,
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
class SeerIterationCompletedActivityTemplate(NotificationTemplate[ActivityNotificationData]):
    category = NotificationCategory.ACTIVITY
    example_data = create_activity_notification_example(
        ActivityType.SEER_ITERATION_COMPLETED,
        activity_data={
            "iteration_index": 2,
            "pull_requests": [
                {
                    "repo_name": "owner/repo",
                    "pull_request": {
                        "pr_url": "https://github.com/owner/repo/pull/42",
                        "pr_number": 42,
                    },
                }
            ],
        },
    )

    def render(self, data: ActivityNotificationData) -> NotificationRenderedTemplate:
        body: list[NotificationSection] = [*get_issue_description(data)]

        if data.activity_data:
            detail_blocks: list[NotificationTextBlock] = []

            iteration_index = data.activity_data.get("iteration_index")
            if iteration_index is not None:
                prefix = f"Iteration #{iteration_index}"
            else:
                prefix = "Iteration"

            for pull_request in data.activity_data.get("pull_requests", []):
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
            subject=get_subject("PR Iteration Completed", data),
            body=body,
        )
