from django.conf import settings

from sentry.models.group import Group
from sentry.notifications.platform.templates.workflow_engine.activity.base import (
    ActivityAlertAction,
    build_alert_footer,
    build_example_alert_footer,
)
from sentry.notifications.platform.types import (
    CodeTextBlock,
    LinkTextBlock,
    NotificationRenderedAction,
    NotificationRenderedTemplate,
    NotificationSection,
    NotificationTextBlock,
    ParagraphSection,
    PlainTextBlock,
)
from sentry.utils.http import absolute_uri

EXAMPLE_SEER_URL = "https://sentry.io/organizations/example/issues/1/?seerDrawer=true"


def get_issue_description(group: Group) -> list[NotificationSection]:
    from sentry.integrations.messaging.message_builder import build_attachment_title

    blocks: list[NotificationTextBlock] = []
    title = build_attachment_title(group)
    if title:
        group_link = absolute_uri(group.get_absolute_url())
        blocks.append(LinkTextBlock(text=title, url=group_link))
    culprit = group.culprit
    if culprit:
        if blocks:
            blocks.append(PlainTextBlock(text="—"))
        blocks.append(CodeTextBlock(text=culprit))
    return [ParagraphSection(blocks=blocks)]


def get_subject(label: str, group: Group) -> list[NotificationTextBlock]:
    if group.qualified_short_id:
        return [PlainTextBlock(text=f"{label} for"), CodeTextBlock(text=group.qualified_short_id)]
    else:
        return [PlainTextBlock(text=f"{label} for a Sentry Issue")]


def get_view_autofix_button(group: Group) -> NotificationRenderedAction:
    link = f"{absolute_uri(group.get_absolute_url())}?seerDrawer=true"
    return NotificationRenderedAction(label="View Autofix", link=link)


def build_template(
    data: ActivityAlertAction,
    subject: list[NotificationTextBlock],
    body: list[NotificationSection],
) -> NotificationRenderedTemplate:
    from sentry.notifications.notification_action.activity_registry.base import (
        extract_notification_models_by_activity,
    )

    activity, group, project, organization = extract_notification_models_by_activity(
        data.activity_id
    )
    footer = build_alert_footer(organization=organization, workflow_id=data.workflow_id)
    if settings.DEBUG and activity.data:
        footer.append(PlainTextBlock(text=f"· Run ID: {activity.data.get('run_id')}"))

    return NotificationRenderedTemplate(
        subject=subject, body=body, actions=[get_view_autofix_button(group)], footer=footer
    )


def get_example_issue_description() -> list[NotificationSection]:
    return [
        ParagraphSection(
            blocks=[
                PlainTextBlock(text="ExampleError: something went wrong"),
                PlainTextBlock(text="—"),
                CodeTextBlock(text="example.module.function"),
            ]
        ),
    ]


def get_example_actions() -> list[NotificationRenderedAction]:
    return [NotificationRenderedAction(label="View Autofix", link=EXAMPLE_SEER_URL)]


def get_example_template(
    subject: str,
    body: list[NotificationSection] | None = None,
    actions: list[NotificationRenderedAction] | None = None,
) -> NotificationRenderedTemplate:
    return NotificationRenderedTemplate(
        subject=subject,
        body=body if body is not None else get_example_issue_description(),
        actions=actions if actions is not None else get_example_actions(),
        footer=build_example_alert_footer(),
    )
