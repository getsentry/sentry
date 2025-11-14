from typing import int
from collections.abc import Sequence

from sentry import features
from sentry.integrations.messaging.message_builder import build_rule_url
from sentry.integrations.slack.message_builder.types import SLACK_URL_FORMAT
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.notifications.utils.links import create_link_to_workflow
from sentry.notifications.utils.rules import get_key_from_rule_data
from sentry.utils.http import absolute_uri


def build_slack_footer(
    group: Group,
    project: Project,
    rules: Sequence[Rule] | None = None,
) -> str:
    footer = f"{group.qualified_short_id}"

    if rules:
        if features.has("organizations:workflow-engine-ui-links", group.organization):
            rule_url = absolute_uri(
                create_link_to_workflow(
                    group.organization.id, get_key_from_rule_data(rules[0], "workflow_id")
                )
            )
        else:
            rule_url = build_rule_url(rules[0], group, project)
        # If this notification is triggered via the "Send Test Notification"
        # button then the label is not defined, but the url works.
        text = rules[0].label if rules[0].label else "Test Alert"
        footer = SLACK_URL_FORMAT.format(text=text, url=rule_url)
        if len(rules) > 1:
            footer += f" (+{len(rules) - 1} other)"

    return footer
