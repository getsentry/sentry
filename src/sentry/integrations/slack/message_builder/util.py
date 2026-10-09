from collections.abc import Sequence

from sentry.integrations.slack.message_builder.types import SLACK_URL_FORMAT
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.notifications.types import NotificationOrigin
from sentry.notifications.utils.rules import get_workflow_url


def build_slack_footer(
    group: Group,
    project: Project,
    rules: Sequence[Rule | NotificationOrigin] | None = None,
) -> str:
    footer = f"{group.qualified_short_id}"

    if rules:
        # If this notification is triggered via the "Send Test Notification"
        # button then the label is not defined.
        text = rules[0].label if rules[0].label else "Test Alert"
        workflow_url = get_workflow_url(rules[0], group.organization.slug)
        footer = SLACK_URL_FORMAT.format(text=text, url=workflow_url) if workflow_url else text
        if len(rules) > 1:
            footer += f" (+{len(rules) - 1} other)"

    return footer
