import logging

from sentry.rules.actions.base import TicketEventAction
from sentry.utils.http import absolute_uri

logger = logging.getLogger("sentry.rules")


class AzureDevopsCreateTicketAction(TicketEventAction):
    id = "sentry.integrations.vsts.notify_action.AzureDevopsCreateTicketAction"
    label = "Create an Azure DevOps work item in {integration} with these "
    ticket_type = "an Azure DevOps work item"
    link = "https://docs.sentry.io/product/integrations/source-code-mgmt/azure-devops/#issue-sync"
    provider = "vsts"

    def generate_footer(self, rule_url: str) -> str:
        return "\nThis work item was automatically created by Sentry via [{}]({})".format(
            # TODO(mgaeta): Bug: Rule is optional.
            self.rule.label,  # type: ignore
            absolute_uri(rule_url),
        )
