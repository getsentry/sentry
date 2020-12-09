from __future__ import absolute_import

import logging
import six

from django import forms

from sentry.models.integration import Integration
from sentry.rules.actions.base import TicketEventAction
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.utils.http import absolute_uri
from sentry.web.decorators import transaction_start

from sentry.integrations.vsts.integration import VstsIntegration

logger = logging.getLogger("sentry.rules")

INTEGRATION_KEY = "integration"


class AzureDevopsNotifyServiceForm(forms.Form):
    vsts_integration = forms.ChoiceField(choices=(), widget=forms.Select())

    def __init__(self, *args, **kwargs):
        integrations = [(i.id, i.name) for i in kwargs.pop("integrations")]
        super(AzureDevopsNotifyServiceForm, self).__init__(*args, **kwargs)

        if integrations:
            self.fields["vsts_integration"].initial = integrations[0][0]

        self.fields["vsts_integration"].choices = integrations
        self.fields["vsts_integration"].widget.choices = self.fields["vsts_integration"].choices

    def clean(self):
        return super(AzureDevopsNotifyServiceForm, self).clean()


class AzureDevopsCreateTicketAction(TicketEventAction):
    form_cls = AzureDevopsNotifyServiceForm

    ticket_type = "an Azure DevOps work item"
    link = "https://docs.sentry.io/product/integrations/azure-devops/#issue-sync"
    label = u"Create an Azure DevOps work item in {vsts_integration} with these "
    prompt = "Create an Azure DevOps work item"
    provider = "vsts"
    integration_key = INTEGRATION_KEY

    def __init__(self, *args, **kwargs):
        super(AzureDevopsCreateTicketAction, self).__init__(*args, **kwargs)
        integration_choices = [(i.id, i.name) for i in self.get_integrations()]

        if not self.get_integration_id() and integration_choices:
            self.data[self.integration_key] = integration_choices[0][0]

        self.form_fields = {
            "vsts_integration": {
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
        return self.label.format(vsts_integration=self.get_integration_name())

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
                fields = vsts_integration.get_create_issue_config_no_params()
            except IntegrationError as e:
                # TODO log when the API call fails.
                logger.info(e)
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

        self.data["title"] = event.title
        self.data["description"] = self.build_description(event, installation)

        def create_issue(event, futures):
            """Create an Azure DevOps work item for a given event"""

            if self.data.get("dynamic_form_fields"):
                del self.data["dynamic_form_fields"]

            if not self.has_linked_issue(event, integration):
                resp = installation.create_issue(self.data)
                self.create_link(resp["metadata"]["display_name"], integration, installation, event)
            else:
                logger.info(
                    "vsts.rule_trigger.link_already_exists",
                    extra={
                        "rule_id": self.rule.id,
                        "project_id": self.project.id,
                        "group_id": event.group.id,
                    },
                )
            return

        key = u"vsts:{}".format(integration.id)
        yield self.future(create_issue, key=key)
