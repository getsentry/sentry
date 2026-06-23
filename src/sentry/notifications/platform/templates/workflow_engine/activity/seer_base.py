from django.conf import settings

from sentry.models.group import Group
from sentry.notifications.platform.types import (
    BoldTextBlock,
    CodeTextBlock,
    NotificationBodyFormattingBlock,
    NotificationData,
    NotificationRenderedAction,
    NotificationRenderedTemplate,
    NotificationSource,
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

EXAMPLE_SEER_URL = "https://sentry.io/organizations/example/issues/1/?seerDrawer=true"
EXAMPLE_ALERT_URL = "https://sentry.io/organizations/example/monitors/alerts/1/"
EXAMPLE_FOOTER = "This notification was sent as part of an alert."


class WorkflowEngineActivityAction(NotificationData):
    source: NotificationSource
    workflow_id: int
    activity_id: int
    activity_type: int
    notification_uuid: str
    detector_id: int


def get_issue_description(group: Group) -> ParagraphBlock:
    from sentry.api.serializers.models.group import get_status_label, get_substatus_label

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


def get_seer_link(group: Group) -> str:
    return f"{absolute_uri(group.get_absolute_url())}?seerDrawer=true"


def build_template(
    data: WorkflowEngineActivityAction,
    subject: str,
    body: list[NotificationBodyFormattingBlock],
    extra_actions: list[NotificationRenderedAction],
) -> NotificationRenderedTemplate:
    from sentry.notifications.notification_action.activity_registry.base import extract_models

    activity, group, project, organization = extract_models(data.activity_id)
    configuration_url = organization.absolute_url(
        f"organizations/{organization.slug}/monitors/alerts/{data.workflow_id}/"
    )
    footer = EXAMPLE_FOOTER
    if settings.DEBUG and activity.data:
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


def get_example_issue_description() -> ParagraphBlock:
    return ParagraphBlock(
        blocks=[
            PlainTextBlock(text="This update pertains to the"),
            CodeTextBlock(text="ExampleError: something went wrong"),
            PlainTextBlock(text="issue"),
            CodeTextBlock(text="EXAMPLE-1"),
            PlainTextBlock(text="in the 'example' project. The issue is"),
            BoldTextBlock(text="Unresolved"),
            PlainTextBlock(text="and has been seen 42 time(s)."),
        ]
    )


def get_example_actions() -> list[NotificationRenderedAction]:
    return [
        NotificationRenderedAction(label="View Alert", link=EXAMPLE_ALERT_URL),
        NotificationRenderedAction(label="View in Sentry", link=EXAMPLE_SEER_URL),
    ]


def get_example_template(
    subject: str,
    body: list[NotificationBodyFormattingBlock] | None = None,
    actions: list[NotificationRenderedAction] | None = None,
) -> NotificationRenderedTemplate:
    return NotificationRenderedTemplate(
        subject=subject,
        body=body if body is not None else [get_example_issue_description()],
        actions=actions if actions is not None else get_example_actions(),
        footer=EXAMPLE_FOOTER,
    )
