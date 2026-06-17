from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.workflow_engine.activity.seer_base import (
    WorkflowEngineActivityAction,
    build_template,
    extract_models,
    get_example_actions,
    get_example_issue_description,
    get_example_template,
    get_issue_description,
    get_seer_link,
)
from sentry.notifications.platform.types import (
    BoldTextBlock,
    NotificationCategory,
    NotificationRenderedAction,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationTemplate,
    ParagraphBlock,
    PlainTextBlock,
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
            subject="Seer has created a pull request",
            body=[
                ParagraphBlock(
                    blocks=[
                        PlainTextBlock(
                            text="The pull request(s) were created for the following repositories: "
                        ),
                        BoldTextBlock(text="getsentry/sentry"),
                    ]
                ),
                get_example_issue_description(),
            ],
            actions=[
                *get_example_actions(),
                NotificationRenderedAction(
                    label="View PR (#1234)",
                    link="https://github.com/getsentry/sentry/pull/1234",
                ),
            ],
        )

    def render(self, data: WorkflowEngineActivityAction) -> NotificationRenderedTemplate:
        activity, group, project, organization = extract_models(data)
        seer_link = get_seer_link(group)

        extra_actions = [NotificationRenderedAction(label="View in Sentry", link=seer_link)]
        repos: set[str] = set()
        for pull_request in activity.data.get("pull_requests", []):
            repo_name = pull_request.get("repo_name")
            if repo_name:
                repos.add(repo_name)
            pr_url = pull_request.get("pull_request", {}).get("pr_url")
            pr_number = pull_request.get("pull_request", {}).get("pr_number")
            label = f"View PR (#{pr_number})" if pr_number else "View PR"
            if pr_url:
                extra_actions.append(NotificationRenderedAction(label=label, link=pr_url))

        subject = (
            "Seer has created a pull request"
            if len(extra_actions) <= 2
            else "Seer has created some pull requests"
        )

        repo_body = ParagraphBlock(
            blocks=[
                PlainTextBlock(
                    text="The pull request(s) were created for the following repositories: "
                ),
                *[BoldTextBlock(text=repo) for repo in repos],
            ]
        )

        return build_template(
            data=data,
            subject=subject,
            body=[repo_body, get_issue_description(group)],
            extra_actions=extra_actions,
        )
