from __future__ import annotations

from typing import Any

from sentry.integrations.jira_server.actions.form import JiraServerNotifyServiceForm
from sentry.integrations.services.integration import RpcIntegration
from sentry.rules.actions import TicketEventAction
from sentry.utils.http import absolute_uri


class JiraServerCreateTicketAction(TicketEventAction):
    id = "sentry.integrations.jira_server.notify_action.JiraServerCreateTicketAction"
    label = "Create a Jira Server issue in {integration} with these "
    ticket_type = "a Jira Server issue"
    link = "https://docs.sentry.io/product/integrations/issue-tracking/jira/#issue-sync"
    provider = "jira_server"

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
        return integration.metadata.get("domain_name", integration.name)

    def get_form_instance(self) -> JiraServerNotifyServiceForm:
        return JiraServerNotifyServiceForm(self.data, integrations=self.get_integrations())
