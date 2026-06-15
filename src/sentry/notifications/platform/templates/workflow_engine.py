from django.conf import settings

from sentry.api.serializers.models.group import get_status_label, get_substatus_label
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.types import (
    BoldTextBlock,
    CodeBlock,
    CodeTextBlock,
    NotificationCategory,
    NotificationData,
    NotificationRenderedAction,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationTemplate,
    ParagraphBlock,
    PlainTextBlock,
)
from sentry.types.activity import ActivityType
from sentry.utils.http import absolute_uri

ACTIVITY_TYPE_TO_SOURCE: dict[int, NotificationSource] = {
    ActivityType.SEER_RCA_STARTED.value: NotificationSource.ACTIVITY_SEER_RCA_STARTED,
    ActivityType.SEER_RCA_COMPLETED.value: NotificationSource.ACTIVITY_SEER_RCA_COMPLETED,
    ActivityType.SEER_SOLUTION_STARTED.value: NotificationSource.ACTIVITY_SEER_SOLUTION_STARTED,
    ActivityType.SEER_SOLUTION_COMPLETED.value: NotificationSource.ACTIVITY_SEER_SOLUTION_COMPLETED,
    ActivityType.SEER_CODING_STARTED.value: NotificationSource.ACTIVITY_SEER_CODING_STARTED,
    ActivityType.SEER_CODING_COMPLETED.value: NotificationSource.ACTIVITY_SEER_CODING_COMPLETED,
    ActivityType.SEER_PR_CREATED.value: NotificationSource.ACTIVITY_SEER_PR_CREATED,
}


class WorkflowEngineActivityAction(NotificationData):
    source: NotificationSource
    workflow_id: int
    activity_id: int
    activity_type: int
    notification_uuid: str
    detector_id: int


class BaseSeerActivityTemplate(NotificationTemplate[WorkflowEngineActivityAction]):
    category = NotificationCategory.WORKFLOW_ENGINE

    activity: Activity | None = None
    group: Group | None = None
    project: Project | None = None
    organization: Organization | None = None

    def _extract_models(
        self, data: WorkflowEngineActivityAction
    ) -> tuple[Activity, Group, Project, Organization]:
        if not self.activity:
            try:
                self.activity = Activity.objects.get(id=data.activity_id)
            except Activity.DoesNotExist:
                raise ValueError(f"Activity not found: {data.activity_id}")
        if not self.group:
            try:
                self.group = Group.objects.get_from_cache(id=self.activity.group_id)
            except Group.DoesNotExist:
                raise ValueError(f"Group not found: {self.activity.group_id}")
        if not self.project:
            try:
                self.project = Project.objects.get_from_cache(id=self.activity.project_id)
            except Project.DoesNotExist:
                raise ValueError(f"Project not found: {self.activity.project_id}")
        if not self.organization:
            try:
                self.organization = Organization.objects.get_from_cache(
                    id=self.project.organization_id
                )
            except Organization.DoesNotExist:
                raise ValueError(f"Organization not found: {self.project.organization_id}")

        return self.activity, self.group, self.project, self.organization

    def _issue_body(self, group: Group) -> ParagraphBlock:
        status_text = get_substatus_label(group) or get_status_label(group)
        return ParagraphBlock(
            blocks=[
                PlainTextBlock(text="This update pertains to the"),
                CodeTextBlock(text=group.title),
                PlainTextBlock(text="issue"),
                CodeTextBlock(text=group.qualified_short_id),
                PlainTextBlock(text=f"in the '{group.project.name}' project. The issue is"),
                BoldTextBlock(text=status_text),
                PlainTextBlock(text=f"and has been seen {group.times_seen} time(s)."),
            ]
        )

    def _seer_url(self, group: Group) -> str:
        return f"{absolute_uri(group.get_absolute_url())}?seerDrawer=true"

    def _build_template(
        self,
        data: WorkflowEngineActivityAction,
        subject: str,
        body: list,
        extra_actions: list[NotificationRenderedAction],
    ) -> NotificationRenderedTemplate:
        activity, group, project, organization = self._extract_models(data)
        configuration_url = organization.absolute_url(
            f"organizations/{organization.slug}/monitors/alerts/{data.workflow_id}/"
        )
        footer = "This notification was sent as part of an alert."
        if settings.DEBUG:
            footer += f" Run ID: {activity.data.get('run_id')}"

        return NotificationRenderedTemplate(
            subject=subject,
            body=body,
            actions=[
                NotificationRenderedAction(label="View Alert", link=configuration_url),
                *extra_actions,
            ],
            footer=footer,
        )

    def _example_issue_body(self) -> ParagraphBlock:
        return ParagraphBlock(
            blocks=[
                PlainTextBlock(text="This update pertains to the"),
                CodeTextBlock(text="ExampleError: something went wrong"),
                PlainTextBlock(text="issue"),
                CodeTextBlock(text="EXAMPLE-1"),
                PlainTextBlock(text="in the 'example-project' project. The issue is"),
                BoldTextBlock(text="Unresolved"),
                PlainTextBlock(text="and has been seen 42 time(s)."),
            ]
        )

    def _example_actions(self) -> list[NotificationRenderedAction]:
        return [
            NotificationRenderedAction(
                label="View Alert",
                link="https://sentry.io/organizations/example/monitors/alerts/1/",
            ),
            NotificationRenderedAction(
                label="View in Sentry",
                link="https://sentry.io/organizations/example/issues/1/?seerDrawer=true",
            ),
        ]

    def _example_template(
        self,
        subject: str,
        body: list[ParagraphBlock | CodeBlock] | None = None,
        actions: list[NotificationRenderedAction] | None = None,
    ) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject=subject,
            body=body if body is not None else [self._example_issue_body()],
            actions=actions if actions is not None else self._example_actions(),
            footer="This notification was sent as part of an alert.",
        )


@template_registry.register(NotificationSource.ACTIVITY_SEER_RCA_STARTED)
class SeerRcaStartedActivityTemplate(BaseSeerActivityTemplate):
    example_data = WorkflowEngineActivityAction(
        source=NotificationSource.ACTIVITY_SEER_RCA_STARTED,
        notification_uuid="1234567890",
        workflow_id=1,
        activity_type=ActivityType.SEER_RCA_STARTED.value,
        activity_id=1,
        detector_id=1,
    )

    def render_example(self) -> NotificationRenderedTemplate:
        return self._example_template("Seer is searching for the root cause...")

    def render(self, data: WorkflowEngineActivityAction) -> NotificationRenderedTemplate:
        activity, group, project, organization = self._extract_models(data)
        return self._build_template(
            data=data,
            subject="Seer is searching for the root cause...",
            body=[self._issue_body(group)],
            extra_actions=[
                NotificationRenderedAction(label="View in Sentry", link=self._seer_url(group))
            ],
        )


@template_registry.register(NotificationSource.ACTIVITY_SEER_RCA_COMPLETED)
class SeerRcaCompletedActivityTemplate(BaseSeerActivityTemplate):
    example_data = WorkflowEngineActivityAction(
        source=NotificationSource.ACTIVITY_SEER_RCA_COMPLETED,
        notification_uuid="1234567890",
        workflow_id=1,
        activity_type=ActivityType.SEER_RCA_COMPLETED.value,
        activity_id=1,
        detector_id=1,
    )

    def render_example(self) -> NotificationRenderedTemplate:
        return self._example_template(
            subject="Seer found the root cause",
            body=[
                CodeBlock(
                    blocks=[
                        PlainTextBlock(
                            text="The error is caused by a null pointer dereference in the user authentication flow."
                        )
                    ]
                ),
                self._example_issue_body(),
            ],
        )

    def render(self, data: WorkflowEngineActivityAction) -> NotificationRenderedTemplate:
        activity, group, project, organization = self._extract_models(data)
        fallback = "Click the link below to view the details in Sentry"
        summary_block = PlainTextBlock(text=activity.data.get("summary", fallback))
        return self._build_template(
            data=data,
            subject="Seer found the root cause",
            body=[CodeBlock(blocks=[summary_block]), self._issue_body(group)],
            extra_actions=[
                NotificationRenderedAction(label="View in Sentry", link=self._seer_url(group))
            ],
        )


@template_registry.register(NotificationSource.ACTIVITY_SEER_SOLUTION_STARTED)
class SeerSolutionStartedActivityTemplate(BaseSeerActivityTemplate):
    example_data = WorkflowEngineActivityAction(
        source=NotificationSource.ACTIVITY_SEER_SOLUTION_STARTED,
        notification_uuid="1234567890",
        workflow_id=1,
        activity_type=ActivityType.SEER_SOLUTION_STARTED.value,
        activity_id=1,
        detector_id=1,
    )

    def render_example(self) -> NotificationRenderedTemplate:
        return self._example_template("Seer is working on a plan...")

    def render(self, data: WorkflowEngineActivityAction) -> NotificationRenderedTemplate:
        activity, group, project, organization = self._extract_models(data)
        return self._build_template(
            data=data,
            subject="Seer is working on a plan...",
            body=[self._issue_body(group)],
            extra_actions=[
                NotificationRenderedAction(label="View in Sentry", link=self._seer_url(group))
            ],
        )


@template_registry.register(NotificationSource.ACTIVITY_SEER_SOLUTION_COMPLETED)
class SeerSolutionCompletedActivityTemplate(BaseSeerActivityTemplate):
    example_data = WorkflowEngineActivityAction(
        source=NotificationSource.ACTIVITY_SEER_SOLUTION_COMPLETED,
        notification_uuid="1234567890",
        workflow_id=1,
        activity_type=ActivityType.SEER_SOLUTION_COMPLETED.value,
        activity_id=1,
        detector_id=1,
    )

    def render_example(self) -> NotificationRenderedTemplate:
        return self._example_template(
            subject="Seer has prepared a plan",
            body=[
                CodeBlock(
                    blocks=[
                        PlainTextBlock(
                            text="Add a null check before accessing user.session in the authentication middleware."
                        )
                    ]
                ),
                self._example_issue_body(),
            ],
        )

    def render(self, data: WorkflowEngineActivityAction) -> NotificationRenderedTemplate:
        activity, group, project, organization = self._extract_models(data)
        fallback = "Click the link below to view the details in Sentry"
        summary_block = PlainTextBlock(text=activity.data.get("summary", fallback))
        return self._build_template(
            data=data,
            subject="Seer has prepared a plan",
            body=[CodeBlock(blocks=[summary_block]), self._issue_body(group)],
            extra_actions=[
                NotificationRenderedAction(label="View in Sentry", link=self._seer_url(group))
            ],
        )


@template_registry.register(NotificationSource.ACTIVITY_SEER_CODING_STARTED)
class SeerCodingStartedActivityTemplate(BaseSeerActivityTemplate):
    example_data = WorkflowEngineActivityAction(
        source=NotificationSource.ACTIVITY_SEER_CODING_STARTED,
        notification_uuid="1234567890",
        workflow_id=1,
        activity_type=ActivityType.SEER_CODING_STARTED.value,
        activity_id=1,
        detector_id=1,
    )

    def render_example(self) -> NotificationRenderedTemplate:
        return self._example_template("Seer is writing code changes...")

    def render(self, data: WorkflowEngineActivityAction) -> NotificationRenderedTemplate:
        activity, group, project, organization = self._extract_models(data)
        return self._build_template(
            data=data,
            subject="Seer is writing code changes...",
            body=[self._issue_body(group)],
            extra_actions=[
                NotificationRenderedAction(label="View in Sentry", link=self._seer_url(group))
            ],
        )


@template_registry.register(NotificationSource.ACTIVITY_SEER_CODING_COMPLETED)
class SeerCodingCompletedActivityTemplate(BaseSeerActivityTemplate):
    example_data = WorkflowEngineActivityAction(
        source=NotificationSource.ACTIVITY_SEER_CODING_COMPLETED,
        notification_uuid="1234567890",
        workflow_id=1,
        activity_type=ActivityType.SEER_CODING_COMPLETED.value,
        activity_id=1,
        detector_id=1,
    )

    def render_example(self) -> NotificationRenderedTemplate:
        return self._example_template(
            subject="Seer's code changes are prepared",
            body=[
                ParagraphBlock(
                    blocks=[
                        PlainTextBlock(
                            text="You can check out the Seer's suggested diff in Sentry."
                        )
                    ]
                ),
                self._example_issue_body(),
            ],
        )

    def render(self, data: WorkflowEngineActivityAction) -> NotificationRenderedTemplate:
        activity, group, project, organization = self._extract_models(data)
        text_block = PlainTextBlock(text="You can check out the Seer's suggested diff in Sentry.")
        return self._build_template(
            data=data,
            subject="Seer's code changes are prepared",
            body=[ParagraphBlock(blocks=[text_block]), self._issue_body(group)],
            extra_actions=[
                NotificationRenderedAction(label="View in Sentry", link=self._seer_url(group))
            ],
        )


@template_registry.register(NotificationSource.ACTIVITY_SEER_PR_CREATED)
class SeerPrCreatedActivityTemplate(BaseSeerActivityTemplate):
    example_data = WorkflowEngineActivityAction(
        source=NotificationSource.ACTIVITY_SEER_PR_CREATED,
        notification_uuid="1234567890",
        workflow_id=1,
        activity_type=ActivityType.SEER_PR_CREATED.value,
        activity_id=1,
        detector_id=1,
    )

    def render_example(self) -> NotificationRenderedTemplate:
        return self._example_template(
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
                self._example_issue_body(),
            ],
            actions=[
                NotificationRenderedAction(
                    label="View Alert",
                    link="https://sentry.io/organizations/example/monitors/alerts/1/",
                ),
                NotificationRenderedAction(
                    label="View in Sentry",
                    link="https://sentry.io/organizations/example/issues/1/?seerDrawer=true",
                ),
                NotificationRenderedAction(
                    label="View PR (#1234)",
                    link="https://github.com/getsentry/sentry/pull/1234",
                ),
            ],
        )

    def render(self, data: WorkflowEngineActivityAction) -> NotificationRenderedTemplate:
        activity, group, project, organization = self._extract_models(data)
        seer_url = self._seer_url(group)

        extra_actions = [NotificationRenderedAction(label="View in Sentry", link=seer_url)]
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

        return self._build_template(
            data=data,
            subject=subject,
            body=[repo_body, self._issue_body(group)],
            extra_actions=extra_actions,
        )
