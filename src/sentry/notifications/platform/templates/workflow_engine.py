from dataclasses import dataclass

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
    NotificationBodyFormattingBlock,
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

SEER_ACTIVITY_TYPES = [
    ActivityType.SEER_RCA_STARTED.value,
    ActivityType.SEER_RCA_COMPLETED.value,
    ActivityType.SEER_SOLUTION_STARTED.value,
    ActivityType.SEER_SOLUTION_COMPLETED.value,
    ActivityType.SEER_CODING_STARTED.value,
    ActivityType.SEER_CODING_COMPLETED.value,
    ActivityType.SEER_PR_CREATED.value,
]

SUPPORTED_ACTIVITY_TYPES = [*SEER_ACTIVITY_TYPES]


class WorkflowEngineActivityAction(NotificationData):
    source: NotificationSource = NotificationSource.WORKFLOW_ENGINE_ACTIVITY_ACTION
    workflow_id: int
    activity_id: int
    activity_type: int
    notification_uuid: str
    detector_id: int


@dataclass
class ActivityNotificationContent:
    subject: str
    body: list[NotificationBodyFormattingBlock]
    actions: list[NotificationRenderedAction]


@template_registry.register(NotificationSource.WORKFLOW_ENGINE_ACTIVITY_ACTION)
class WorkflowEngineActivityActionTemplate(NotificationTemplate[WorkflowEngineActivityAction]):
    category = NotificationCategory.WORKFLOW_ENGINE
    example_data = WorkflowEngineActivityAction(
        notification_uuid="1234567890",
        workflow_id=1,
        activity_type=1,
        activity_id=1,
        detector_id=1,
    )
    activity: Activity | None = None
    group: Group | None = None
    project: Project | None = None
    organization: Organization | None = None

    def get_seer_content(
        self,
        data: WorkflowEngineActivityAction,
        activity: Activity,
        group: Group,
        project: Project,
    ) -> ActivityNotificationContent:
        if data.activity_type not in SEER_ACTIVITY_TYPES:
            raise ValueError(
                f"Routed to seer content for non-seer activity type: {data.activity_type}"
            )
        seer_fallback_text = "Click the link below to view the details in Sentry"

        seer_url = f"{absolute_uri(group.get_absolute_url())}?seerDrawer=true"
        status_text = get_substatus_label(group) or get_status_label(group)
        issue_body = ParagraphBlock(
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

        match data.activity_type:
            case ActivityType.SEER_RCA_STARTED.value:
                return ActivityNotificationContent(
                    subject="Seer is searching for the root cause...",
                    body=[issue_body],
                    actions=[NotificationRenderedAction(label="View in Sentry", link=seer_url)],
                )
            case ActivityType.SEER_RCA_COMPLETED.value:
                summary_block = PlainTextBlock(
                    text=activity.data.get("summary", seer_fallback_text)
                )
                return ActivityNotificationContent(
                    subject="Seer found the root cause",
                    body=[issue_body, CodeBlock(blocks=[summary_block])],
                    actions=[NotificationRenderedAction(label="View in Sentry", link=seer_url)],
                )
            case ActivityType.SEER_SOLUTION_STARTED.value:
                return ActivityNotificationContent(
                    subject="Seer is working on a plan...",
                    body=[issue_body],
                    actions=[NotificationRenderedAction(label="View in Sentry", link=seer_url)],
                )
            case ActivityType.SEER_SOLUTION_COMPLETED.value:
                summary_block = PlainTextBlock(
                    text=activity.data.get("summary", seer_fallback_text)
                )
                return ActivityNotificationContent(
                    subject="Seer has prepared a plan",
                    body=[issue_body, CodeBlock(blocks=[summary_block])],
                    actions=[NotificationRenderedAction(label="View in Sentry", link=seer_url)],
                )
            case ActivityType.SEER_CODING_STARTED.value:
                return ActivityNotificationContent(
                    subject="Seer is writing code changes...",
                    body=[issue_body],
                    actions=[NotificationRenderedAction(label="View in Sentry", link=seer_url)],
                )
            case ActivityType.SEER_CODING_COMPLETED.value:
                text_block = PlainTextBlock(text="Check out the Seer's suggested diff in Sentry.")
                return ActivityNotificationContent(
                    subject="Seer's code changes are prepared",
                    body=[issue_body, ParagraphBlock(blocks=[text_block])],
                    actions=[NotificationRenderedAction(label="View in Sentry", link=seer_url)],
                )
            case ActivityType.SEER_PR_CREATED.value:
                actions = [NotificationRenderedAction(label="View in Sentry", link=seer_url)]
                repos: set[str] = set()
                for pull_request in activity.data.get("pull_requests", []):
                    repo_name = pull_request.get("repo_name")
                    if repo_name:
                        repos.add(repo_name)
                    pr_url = pull_request.get("pull_request", {}).get("pr_url")
                    pr_number = pull_request.get("pull_request", {}).get("pr_number")
                    label = f"View PR (#{pr_number})" if pr_number else "View PR"
                    if pr_url:
                        actions.append(NotificationRenderedAction(label=label, link=pr_url))

                subject = (
                    "Seer has created a pull request"
                    if len(actions) > 2
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

                return ActivityNotificationContent(
                    subject=subject,
                    body=[issue_body, repo_body],
                    actions=actions,
                )
            case _:
                raise ValueError(f"Unsupported activity type: {data.activity_type}")

    def get_activity_content(
        self, data: WorkflowEngineActivityAction
    ) -> ActivityNotificationContent:
        if data.activity_type not in SUPPORTED_ACTIVITY_TYPES:
            raise ValueError(f"Unsupported activity type: {data.activity_type}")

        activity, group, project, organization = self._extract_models_from_data(data=data)
        if data.activity_type in SEER_ACTIVITY_TYPES:
            return self.get_seer_content(data=data, activity=activity, group=group, project=project)

        raise ValueError(f"Unsupported activity type: {data.activity_type}")

    def _extract_models_from_data(
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

    def render(self, data: WorkflowEngineActivityAction) -> NotificationRenderedTemplate:
        activity, group, project, organization = self._extract_models_from_data(data=data)
        configuration_url = organization.absolute_url(
            f"/organizations/{organization.id}/monitors/alerts/{data.workflow_id}/"
        )
        footer = "This notification was sent as part of an alert."
        if settings.DEBUG and data.activity_type in SEER_ACTIVITY_TYPES:
            footer += f" Run ID: {activity.data.get('run_id')}"

        content = self.get_activity_content(data=data)
        template = NotificationRenderedTemplate(
            subject=content.subject,
            body=content.body,
            actions=[
                NotificationRenderedAction(label="View Alert", link=configuration_url),
                *content.actions,
            ],
            footer=footer,
        )
        return template
