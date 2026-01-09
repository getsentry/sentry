from collections.abc import Sequence

from sentry.integrations.messaging.message_builder import build_rule_url
from sentry.integrations.slack.message_builder.types import SLACK_URL_FORMAT
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.notifications.utils.links import create_link_to_workflow
from sentry.notifications.utils.rules import get_rule_or_workflow_id
from sentry.utils.http import absolute_uri


def build_slack_footer(
    group: Group,
    project: Project,
    rules: Sequence[Rule] | None = None,
) -> str:
    footer = f"{group.qualified_short_id}"

    if rules:
        key, value = get_rule_or_workflow_id(rules[0])
        if key == "legacy_rule_id":
            rule_url = build_rule_url(rules[0], group, project)
        else:
            rule_url = absolute_uri(create_link_to_workflow(group.organization.id, value))
        # If this notification is triggered via the "Send Test Notification"
        # button then the label is not defined, but the url works.
        text = rules[0].label if rules[0].label else "Test Alert"
        footer = SLACK_URL_FORMAT.format(text=text, url=rule_url)
        if len(rules) > 1:
            footer += f" (+{len(rules) - 1} other)"

    return footer
