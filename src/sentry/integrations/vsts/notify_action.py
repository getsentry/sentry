from __future__ import absolute_import

import logging
import six

from django import forms

from sentry.models.integration import Integration
from sentry.rules.actions.base import TicketEventAction, create_issue
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.utils.http import absolute_uri
from sentry.web.decorators import transaction_start

from sentry.integrations.vsts.integration import VstsIntegration

logger = logging.getLogger("sentry.rules")

INTEGRATION_KEY = "integration"


class AzureDevopsNotifyServiceForm(forms.Form):
    integration = forms.ChoiceField(choices=(), widget=forms.Select())

    def __init__(self, *args, **kwargs):
        integrations = [(i.id, i.name) for i in kwargs.pop("integrations")]
        super(AzureDevopsNotifyServiceForm, self).__init__(*args, **kwargs)
        if integrations:
            self.fields[INTEGRATION_KEY].initial = integrations[0][0]

        self.fields[INTEGRATION_KEY].choices = integrations
        self.fields[INTEGRATION_KEY].widget.choices = self.fields[INTEGRATION_KEY].choices

    def clean(self):
        return super(AzureDevopsNotifyServiceForm, self).clean()


class AzureDevopsCreateTicketAction(TicketEventAction):
    form_cls = AzureDevopsNotifyServiceForm
    label = u"Create an Azure DevOps work item in {integration} with these "
    ticket_type = "an Azure DevOps work item"
    link = "https://docs.sentry.io/product/integrations/azure-devops/#issue-sync"
    provider = "vsts"
    integration_key = INTEGRATION_KEY

    def __init__(self, *args, **kwargs):
        super(AzureDevopsCreateTicketAction, self).__init__(*args, **kwargs)
        integration_choices = [(i.id, i.name) for i in self.get_integrations()]

        if not self.get_integration_id() and integration_choices:
            self.data[self.integration_key] = integration_choices[0][0]

        self.form_fields = {
            self.integration_key: {
                "choices": integration_choices,
                "initial": six.text_type(self.get_integration_id()),
                "type": "choice",
                "updatesForm": True,
            },
        }

        dynamic_fields = self.get_dynamic_form_fields()
        if dynamic_fields:
            for field in dynamic_fields:
                self.form_fields[field["name"]] = field

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
            pass
        else:
            vsts_integration = VstsIntegration(integration, self.project.organization.id)
            try:
                fields = vsts_integration.get_create_issue_config_no_group(self.project)
            except IntegrationError as e:
                # TODO log when the API call fails.
                logger.info(e)
                return self.error(six.text_type(e))
            else:
                self.data["dynamic_form_fields"] = fields
                return fields
        return None

    def generate_footer(self, rule_url):
        return u"\nThis work item was automatically created by Sentry via [{}]({})".format(
            self.rule.label, absolute_uri(rule_url),
        )

    @transaction_start("AzureDevopsCreateTicketAction.after")
    def after(self, event, state):
        organization = self.project.organization
        try:
            integration = self.get_integration()
        except Integration.DoesNotExist:
            # Integration removed, rule still active.
            return

        installation = integration.get_installation(organization.id)

        self.data["description"] = self.build_description(event, installation)
        key = u"vsts:{}".format(integration.id)
        yield self.future(
            create_issue,
            key=key,
            data=self.data,
            integration=integration,
            issue_key_path="metadata.display_name",
        )
