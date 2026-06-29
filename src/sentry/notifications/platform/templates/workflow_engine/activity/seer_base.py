from django.conf import settings

from sentry.models.group import Group
from sentry.notifications.platform.types import (
    CodeTextBlock,
    NotificationData,
    NotificationRenderedAction,
    NotificationRenderedTemplate,
    NotificationSection,
    NotificationSource,
    NotificationTextBlock,
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
    ActivityType.SEER_ITERATION_STARTED.value: NotificationSource.ACTIVITY_SEER_ITERATION_STARTED,
    ActivityType.SEER_ITERATION_COMPLETED.value: NotificationSource.ACTIVITY_SEER_ITERATION_COMPLETED,
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


def get_issue_description(group: Group) -> list[NotificationSection]:
    from sentry.integrations.messaging.message_builder import build_attachment_title

    blocks: list[NotificationTextBlock] = []
    title = build_attachment_title(group)
    if title:
        blocks.append(PlainTextBlock(text=title))
    culprit = group.culprit
    if culprit:
        if blocks:
            blocks.append(PlainTextBlock(text="—"))
        blocks.append(CodeTextBlock(text=culprit))
    return [ParagraphBlock(blocks=blocks)]


def get_subject(label: str, group: Group) -> str:
    short_id = group.qualified_short_id or "unknown"
    return f"{label} for {short_id}"


def get_view_in_sentry_button(group: Group) -> NotificationRenderedAction:
    link = f"{absolute_uri(group.get_absolute_url())}?seerDrawer=true"
    return NotificationRenderedAction(label="View in Sentry", link=link)


def build_template(
    data: WorkflowEngineActivityAction,
    subject: str,
    body: list[NotificationSection],
    extra_actions: list[NotificationRenderedAction],
) -> NotificationRenderedTemplate:
    from sentry.notifications.notification_action.activity_registry.base import (
        extract_notification_models_by_activity,
    )

    activity, group, project, organization = extract_notification_models_by_activity(
        data.activity_id
    )
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


def get_example_issue_description() -> list[NotificationSection]:
    return [
        ParagraphBlock(
            blocks=[
                PlainTextBlock(text="ExampleError: something went wrong"),
                PlainTextBlock(text="—"),
                CodeTextBlock(text="example.module.function"),
            ]
        ),
    ]


def get_example_actions() -> list[NotificationRenderedAction]:
    return [
        NotificationRenderedAction(label="View Alert", link=EXAMPLE_ALERT_URL),
        NotificationRenderedAction(label="View in Sentry", link=EXAMPLE_SEER_URL),
    ]


def get_example_template(
    subject: str,
    body: list[NotificationSection] | None = None,
    actions: list[NotificationRenderedAction] | None = None,
) -> NotificationRenderedTemplate:
    return NotificationRenderedTemplate(
        subject=subject,
        body=body if body is not None else get_example_issue_description(),
        actions=actions if actions is not None else get_example_actions(),
        footer=EXAMPLE_FOOTER,
    )
