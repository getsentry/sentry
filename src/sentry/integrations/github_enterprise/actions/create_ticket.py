from __future__ import annotations

from sentry.rules.actions import TicketEventAction
from sentry.utils.http import absolute_uri


class GitHubEnterpriseCreateTicketAction(TicketEventAction):
    id = "sentry.integrations.github_enterprise.notify_action.GitHubEnterpriseCreateTicketAction"
    label = "Create a Github Enterprise issue in {integration} with these "
    ticket_type = "a Github Enterprise issue"
    # link appears to go to syncing issues docs for existing
    # Jira + Azure DevOps actions. We don't sync for GitHub, so need to
    # figure out what to put here
    link = "https://docs.sentry.io/product/integrations/source-code-mgmt/azure-devops/#issue-sync"
    provider = "github_enterprise"

    def generate_footer(self, rule_url: str) -> str:
        return "\nThis work item was automatically created by Sentry via [{}]({})".format(
            self.rule.label,
            absolute_uri(rule_url),
        )
