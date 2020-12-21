from __future__ import absolute_import

import logging

from sentry.rules.actions.base import (
    TicketEventAction,
    IntegrationNotifyServiceForm,
    INTEGRATION_KEY,
)
from sentry.utils.http import absolute_uri
from sentry.web.decorators import transaction_start


logger = logging.getLogger("sentry.rules")


class AzureDevopsCreateTicketAction(TicketEventAction):
    form_cls = IntegrationNotifyServiceForm
    label = u"Create an Azure DevOps work item in {integration} with these "
    ticket_type = "an Azure DevOps work item"
    link = "https://docs.sentry.io/product/integrations/azure-devops/#issue-sync"
    provider = "vsts"
    issue_key_path = "metadata.display_name"
    integration_key = INTEGRATION_KEY

    def render_label(self):
        return self.label.format(integration=self.get_integration_name())

    def generate_footer(self, rule_url):
        return u"\nThis work item was automatically created by Sentry via [{}]({})".format(
            self.rule.label, absolute_uri(rule_url),
        )

    @transaction_start("AzureDevopsCreateTicketAction.after")
    def after(self, event, state):
        yield super(AzureDevopsCreateTicketAction, self).after(event, state)
