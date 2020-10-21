from __future__ import absolute_import

import logging

from django import forms

from sentry.rules.actions.base import IntegrationEventAction

logger = logging.getLogger("sentry.rules")


class AzureDevopsNotifyServiceForm(forms.Form):
    # TODO 2.0 Add form fields.

    def __init__(self, *args, **kwargs):
        super(AzureDevopsNotifyServiceForm, self).__init__(*args, **kwargs)

    def clean(self):
        return super(AzureDevopsNotifyServiceForm, self).clean()


class AzureDevopsCreateTicketAction(EventAction):
    form_cls = AzureDevopsNotifyServiceForm
    label = u"TODO Create a {name} AzureDevops workitem"
    prompt = "Create a AzureDevops workitem"
    provider = "vsts"
    integration_key = "project"

    def __init__(self, *args, **kwargs):
        super(AzureDevopsCreateTicketAction, self).__init__(*args, **kwargs)
        # TODO 2.1 Add form_fields
        self.form_fields = {}

    def render_label(self):
        return self.label.format(name=self.get_integration_name())

    def after(self, event, state):
        pass
