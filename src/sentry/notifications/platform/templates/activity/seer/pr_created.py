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
)
from sentry.types.activity import ActivityType


@template_registry.register(NotificationSource.ACTIVITY_SEER_PR_CREATED)
class SeerPrCreatedActivityTemplate(NotificationTemplate[ActivityNotificationData]):
    category = NotificationCategory.ACTIVITY
    example_data = create_activity_notification_example(
        ActivityType.SEER_PR_CREATED,
        activity_data={
            "pull_requests": [
                {
                    "repo_name": "getsentry/sentry",
                    "pull_request": {
                        "pr_url": "https://github.com/getsentry/sentry/pull/1234",
                        "pr_number": 1234,
                    },
                }
            ]
        },
    )

    def render(self, data: ActivityNotificationData) -> NotificationRenderedTemplate:
        pr_links: list[NotificationTextBlock] = []
        if data.activity_data:
            for pull_request in data.activity_data.get("pull_requests", []):
                repo_name = pull_request.get("repo_name", "")
                pr_url = pull_request.get("pull_request", {}).get("pr_url")
                pr_number = pull_request.get("pull_request", {}).get("pr_number")
                if pr_url:
                    label = f"{repo_name} (#{pr_number})" if pr_number else repo_name
                    pr_links.append(LinkTextBlock(text=label, url=pr_url))

        body: list[NotificationSection] = [*get_issue_description(data)]
        if pr_links:
            body.append(ParagraphSection(blocks=pr_links))

        return build_template(
            data=data,
            subject=get_subject("Pull Request Created", data),
            body=body,
        )
