from __future__ import absolute_import

import logging
import six

from django import forms

from sentry.models.integration import Integration
from sentry.rules.actions.base import TicketEventAction, NotifyServiceForm, INTEGRATION_KEY
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.utils.http import absolute_uri
from sentry.web.decorators import transaction_start

from sentry.integrations.vsts.integration import VstsIntegration

logger = logging.getLogger("sentry.rules")


class AzureDevopsNotifyServiceForm(NotifyServiceForm):
    integration = forms.ChoiceField(choices=(), widget=forms.Select())

    def __init__(self, *args, **kwargs):
        super(AzureDevopsNotifyServiceForm, self).__init__(*args, **kwargs)

    def clean(self):
        return super(AzureDevopsNotifyServiceForm, self).clean()


class AzureDevopsCreateTicketAction(TicketEventAction):
    form_cls = AzureDevopsNotifyServiceForm
    label = u"Create an Azure DevOps work item in {integration} with these "
    ticket_type = "an Azure DevOps work item"
    link = "https://docs.sentry.io/product/integrations/azure-devops/#issue-sync"
    provider = "vsts"
    issue_key_path = "metadata.display_name"
    integration_key = INTEGRATION_KEY

    def render_label(self):
        return self.label.format(integration=self.get_integration_name())

    def get_dynamic_form_fields(self):
        """
        Either get the dynamic form fields cached on the DB or make an API call
        to VSTS to get them for the selected integration. If both fail, return `None`.

        :return: Django form fields dictionary
        """
        if "dynamic_form_fields" in self.data:
            return self.data["dynamic_form_fields"]

        try:
            integration = self.get_integration()
        except Integration.DoesNotExist:
            return None
        vsts_integration = VstsIntegration(integration, self.project.organization.id)
        try:
            fields = vsts_integration.get_create_issue_config_no_group(project=self.project)
        except IntegrationError as e:
            # TODO log when the API call fails.
            logger.info(e)
            return self.error(six.text_type(e))
        else:
            form_fields = {}
            for field in fields:
                if "name" in field:
                    form_fields[field["name"]] = field
            self.data["dynamic_form_fields"] = form_fields
            return form_fields
        return None

    def generate_footer(self, rule_url):
        return u"\nThis work item was automatically created by Sentry via [{}]({})".format(
            self.rule.label, absolute_uri(rule_url),
        )

    @transaction_start("AzureDevopsCreateTicketAction.after")
    def after(self, event, state):
        yield super(AzureDevopsCreateTicketAction, self).after(event, state)
