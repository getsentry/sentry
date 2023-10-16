from __future__ import annotations

from sentry.rules.actions import TicketEventAction
from sentry.utils.http import absolute_uri


class GitHubCreateTicketAction(TicketEventAction):
    id = "sentry.integrations.github.notify_action.GitHubCreateTicketAction"
    label = "Create a Github work item in {integration} with these "
    ticket_type = "a Github work item"
    # link appears to go to syncing issues docs for existing
    # Jira + Azure DevOps actions. We don't sync for GitHub, so need to
    # figure out what to put here
    link = "https://docs.sentry.io/product/integrations/source-code-mgmt/azure-devops/#issue-sync"
    provider = "github"

    def generate_footer(self, rule_url: str) -> str:
        return "\nThis work item was automatically created by Sentry via [{}]({})".format(
            self.rule.label,
            absolute_uri(rule_url),
        )
