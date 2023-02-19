from __future__ import annotations

from typing import Any

from sentry.integrations.jira.actions.form import JiraNotifyServiceForm
from sentry.rules.actions import TicketEventAction
from sentry.services.hybrid_cloud.integration import RpcIntegration
from sentry.utils.http import absolute_uri


class JiraCreateTicketAction(TicketEventAction):
    id = "sentry.integrations.jira.notify_action.JiraCreateTicketAction"
    label = "Create a Jira issue in {integration} with these "
    ticket_type = "a Jira issue"
    link = "https://docs.sentry.io/product/integrations/issue-tracking/jira/#issue-sync"
    provider = "jira"
    form_cls = JiraNotifyServiceForm

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)

        fix_versions = self.data.get("fixVersions")
        if fix_versions and not isinstance(fix_versions, list):
            self.data["fixVersions"] = [fix_versions]

    def generate_footer(self, rule_url: str) -> str:
        return "This ticket was automatically created by Sentry via [{}|{}]".format(
            self.rule.label,
            absolute_uri(rule_url),
        )

    def translate_integration(self, integration: RpcIntegration) -> str:
        name = integration.metadata.get("domain_name", integration.name)
        return name.replace(".atlassian.net", "")
