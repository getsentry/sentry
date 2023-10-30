from __future__ import annotations

from sentry.rules.actions import TicketEventAction
from sentry.utils.http import absolute_uri


class GitHubCreateTicketAction(TicketEventAction):
    id = "sentry.integrations.github.notify_action.GitHubCreateTicketAction"
    label = "Create a GitHub issue in {integration} with these "
    ticket_type = "a GitHub issue"
    # TODO(schew2381): Add link to docs once GitHub issue sync is available
    link = None
    provider = "github"

    def generate_footer(self, rule_url: str) -> str:
        return "\nThis issue was automatically created by Sentry via [{}]({})".format(
            self.rule.label,
            absolute_uri(rule_url),
        )
