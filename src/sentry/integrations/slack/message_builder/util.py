from collections.abc import Sequence

from sentry.integrations.slack.message_builder.types import SLACK_URL_FORMAT
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.notifications.types import NotificationOrigin
from sentry.notifications.utils.rules import get_workflow_url


def build_slack_footer(
    group: Group,
    project: Project,
    rules: Sequence[NotificationOrigin] | None = None,
) -> str:
    footer = f"{group.qualified_short_id}"

    if rules:
        origin = rules[0]
        # If this notification is triggered via the "Send Test Notification"
        # button then the label is not defined.
        text = origin.label if origin.label else "Test Alert"
        workflow_url = get_workflow_url(origin, group.organization.slug)
        footer = SLACK_URL_FORMAT.format(text=text, url=workflow_url) if workflow_url else text
        if len(rules) > 1:
            footer += f" (+{len(rules) - 1} other)"

    return footer
