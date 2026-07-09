from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.workflow_engine.activity.base import (
    WorkflowEngineActivityAction,
    build_alert_footer,
    build_example_issue_link,
    build_issue_link,
)
from sentry.notifications.platform.templates.workflow_engine.activity.set_resolved.base import (
    get_resolution_subject,
    render_resolution_example,
)
from sentry.notifications.platform.types import (
    BlockQuoteSection,
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


@template_registry.register(NotificationSource.ACTIVITY_SET_RESOLVED_IN_PULL_REQUEST)
class SetResolvedInPullRequestActivityTemplate(NotificationTemplate[WorkflowEngineActivityAction]):
    category = NotificationCategory.WORKFLOW_ENGINE
    example_data = WorkflowEngineActivityAction(
        source=NotificationSource.ACTIVITY_SET_RESOLVED_IN_PULL_REQUEST,
        notification_uuid="1234567890",
        workflow_id=1,
        activity_type=ActivityType.SET_RESOLVED_IN_PULL_REQUEST.value,
        activity_id=1,
        detector_id=1,
    )

    def render_example(self) -> NotificationRenderedTemplate:
        return render_resolution_example(
            body=[
                ParagraphSection(
                    blocks=[
                        build_example_issue_link(),
                        PlainTextBlock(text="was resolved in"),
                        LinkTextBlock(
                            text="a pull request",
                            url="https://github.com/getsentry/sentry/pull/1234",
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
        resolution_blocks: list[NotificationTextBlock] = [
            PlainTextBlock(text="was resolved in a pull request.")
        ]
        extra_body_sections: list[NotificationSection] = []
        if activity.data and "pull_request" in activity.data:
            try:
                pr = PullRequest.objects.get(id=activity.data["pull_request"])
                repo = Repository.objects.get(id=pr.repository_id)
            except (PullRequest.DoesNotExist, Repository.DoesNotExist):
                pass
            else:
                pr_label = f"{repo.name} (#{pr.key})"
                pr_url = pr.get_external_url()
                pr_description = pr.title or pr.message
                if pr_url:
                    resolution_blocks = [
                        PlainTextBlock(text="was resolved in"),
                        LinkTextBlock(text=pr_label, url=pr_url),
                    ]
                else:
                    resolution_blocks = [
                        PlainTextBlock(text=f"was resolved in {pr_label}."),
                    ]
                if pr_description:
                    extra_body_sections.append(
                        BlockQuoteSection(blocks=[PlainTextBlock(text=pr_description)])
                    )

        return NotificationRenderedTemplate(
            subject=get_resolution_subject(activity, group),
            body=[
                ParagraphSection(
                    blocks=[build_issue_link(group), *resolution_blocks],
                ),
                *extra_body_sections,
            ],
            footer=build_alert_footer(organization=organization, workflow_id=data.workflow_id),
        )
