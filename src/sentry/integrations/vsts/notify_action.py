from __future__ import absolute_import

import logging

from django import forms

from sentry.rules.actions.base import TicketEventAction
from sentry.utils.http import absolute_uri
from sentry.web.decorators import transaction_start

logger = logging.getLogger("sentry.rules")


class AzureDevopsNotifyServiceForm(forms.Form):
    # TODO 2.0 Add form fields.
    def __init__(self, *args, **kwargs):
        super(AzureDevopsNotifyServiceForm, self).__init__(*args, **kwargs)

    def clean(self):
        return super(AzureDevopsNotifyServiceForm, self).clean()


class AzureDevopsCreateTicketAction(TicketEventAction):
    form_cls = AzureDevopsNotifyServiceForm
    label = u"TODO Create an Azure DevOps work item in {name} with these "
    prompt = "Create an Azure DevOps work item"
    provider = "vsts"
    integration_key = "vsts_integration"

    def __init__(self, *args, **kwargs):
        super(AzureDevopsCreateTicketAction, self).__init__(*args, **kwargs)
        # TODO 2.1 Add form_fields
        self.form_fields = {}

    def render_label(self):
        return self.label.format(name=self.get_integration_name())

    def generate_footer(self, rule_url):
        return u"\nThis work item was automatically created by Sentry via [{}]({})".format(
            self.rule.label, absolute_uri(rule_url),
        )

    @transaction_start("AzureDevopsCreateTicketAction.after")
    def after(self, event, state):
        organization = self.project.organization
        integration = self.get_integration()
        installation = integration.get_installation(organization.id)
        self.data["description"] = self.build_description(event, installation)

        def create_issue(event, futures):
            """Create an Azure DevOps work item for a given event"""

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
