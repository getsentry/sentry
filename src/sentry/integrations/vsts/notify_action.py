import logging

from sentry.rules.actions.base import TicketEventAction
from sentry.utils.http import absolute_uri
from sentry.web.decorators import transaction_start

logger = logging.getLogger("sentry.rules")


class AzureDevopsCreateTicketAction(TicketEventAction):
    label = "Create an Azure DevOps work item in {integration} with these "
    ticket_type = "an Azure DevOps work item"
    link = "https://docs.sentry.io/product/integrations/azure-devops/#issue-sync"
    provider = "vsts"
    integration_key = "integration"

    def generate_footer(self, rule_url):
        return "\nThis work item was automatically created by Sentry via [{}]({})".format(
            self.rule.label,
            absolute_uri(rule_url),
        )

    @transaction_start("AzureDevopsCreateTicketAction.after")
    def after(self, event, state):
        yield super().after(event, state)
