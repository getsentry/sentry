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
    LinkTextBlock,
    NotificationCategory,
    NotificationRenderedTemplate,
    NotificationSection,
    NotificationSource,
    NotificationTemplate,
    NotificationTextBlock,
    ParagraphBlock,
)
from sentry.types.activity import ActivityType


@template_registry.register(NotificationSource.ACTIVITY_SEER_PR_CREATED)
class SeerPrCreatedActivityTemplate(NotificationTemplate[WorkflowEngineActivityAction]):
    category = NotificationCategory.WORKFLOW_ENGINE
    example_data = WorkflowEngineActivityAction(
        source=NotificationSource.ACTIVITY_SEER_PR_CREATED,
        notification_uuid="1234567890",
        workflow_id=1,
        activity_type=ActivityType.SEER_PR_CREATED.value,
        activity_id=1,
        detector_id=1,
    )

    def render_example(self) -> NotificationRenderedTemplate:
        return get_example_template(
            subject="Seer PR Created for EXAMPLE-1",
            body=[
                *get_example_issue_description(),
                ParagraphBlock(
                    blocks=[
                        LinkTextBlock(
                            text="getsentry/sentry (#1234)",
                            url="https://github.com/getsentry/sentry/pull/1234",
                        ),
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

        pr_links: list[NotificationTextBlock] = []
        if activity.data:
            for pull_request in activity.data.get("pull_requests", []):
                repo_name = pull_request.get("repo_name", "")
                pr_url = pull_request.get("pull_request", {}).get("pr_url")
                pr_number = pull_request.get("pull_request", {}).get("pr_number")
                if pr_url:
                    label = f"{repo_name} (#{pr_number})" if pr_number else repo_name
                    pr_links.append(LinkTextBlock(text=label, url=pr_url))

        body: list[NotificationSection] = [*get_issue_description(group)]
        if pr_links:
            body.append(ParagraphBlock(blocks=pr_links))

        return build_template(
            data=data,
            subject=get_subject("Seer PR Created", group),
            body=body,
            extra_actions=[get_view_in_sentry_button(group)],
        )
