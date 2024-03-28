from __future__ import annotations

from sentry.rules.actions import TicketEventAction
from sentry.utils.http import absolute_uri


class GitHubEnterpriseCreateTicketAction(TicketEventAction):
    id = "sentry.integrations.github_enterprise.notify_action.GitHubEnterpriseCreateTicketAction"
    label = "Create a GitHub Enterprise issue in {integration} with these "
    ticket_type = "a GitHub Enterprise issue"
    # TODO(schew2381): Add link to docs once GitHub issue sync is available
    link = None
    provider = "github_enterprise"

    def generate_footer(self, rule_url: str) -> str:
        return "\nThis issue was automatically created by Sentry via [{}]({})".format(
            self.rule.label,
            absolute_uri(rule_url),
        )
