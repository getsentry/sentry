from __future__ import annotations

from sentry.integrations.types import IntegrationProviderSlug
from sentry.rules.actions import TicketEventAction
from sentry.utils.http import absolute_uri


class GitlabCreateTicketAction(TicketEventAction):
    id = "sentry.integrations.gitlab.notify_action.GitlabCreateTicketAction"
    label = "Create a GitLab issue in {integration} with these "
    ticket_type = "a GitLab issue"
    link = "https://docs.sentry.io/product/integrations/source-code-mgmt/gitlab/#issue-management"
    provider = IntegrationProviderSlug.GITLAB.value

    def generate_footer(self, rule_url: str) -> str:
        return f"\nThis issue was automatically created by Sentry via [{self.rule.label}]({absolute_uri(rule_url)})"
