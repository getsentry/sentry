from __future__ import absolute_import

import logging

from django import forms

from sentry.rules.actions.base import IntegrationEventAction
from sentry.models import ExternalIssue
from sentry.utils.http import absolute_uri

logger = logging.getLogger("sentry.rules")


class AzureDevopsNotifyServiceForm(forms.Form):
    # TODO 2.0 Add form fields.
    ado_project = forms.ChoiceField(choices=(), widget=forms.Select())  # rm
    work_item_type = forms.ChoiceField(choices=(), widget=forms.Select())  # rm

    def __init__(self, *args, **kwargs):
        projects_list = [(i.id, i.name) for i in kwargs.pop("integrations")]  # rm
        super(AzureDevopsNotifyServiceForm, self).__init__(*args, **kwargs)
        # rm  start
        if projects_list:
            self.fields["ado_project"].initial = projects_list[0][0]

        self.fields["ado_project"].choices = projects_list
        self.fields["ado_project"].widget.choices = self.fields["ado_project"].choices

        self.fields["work_item_type"].choices = HARDCODED_WORK_ITEM_TYPES
        self.fields["work_item_type"].widget.choices = self.fields["work_item_type"].choices
        # rm end

    def clean(self):
        return super(AzureDevopsNotifyServiceForm, self).clean()


HARDCODED_WORK_ITEM_TYPES = [
    ("Issue", "Issue"),
    ("Epic", "Epic"),
]  # rm


class AzureDevopsCreateTicketAction(IntegrationEventAction):
    form_cls = AzureDevopsNotifyServiceForm
    label = u"TODO Create a {ado_integration} {ado_project} ADO work item, name: {name} type: {work_item_type}!"  # rm
    prompt = "Create an Azure DevOps work item"
    provider = "vsts"
    integration_key = "ado_integration"

    def __init__(self, *args, **kwargs):
        super(AzureDevopsCreateTicketAction, self).__init__(*args, **kwargs)
        # TODO 2.1 Add form_fields
        # self.form_fields = {}

        # rm start
        all_integrations = self.get_integrations()
        integration_choices = [(i.id, i.name) for i in all_integrations]

        self.form_fields = {
            "ado_integration": {
                "type": "choice",
                "choices": integration_choices,
                "default": integration_choices[0][0],
                "updatesForm": True,
            },
            "ado_project": {
                "type": "choice",
                "choices": integration_choices,
                "default": integration_choices[0][0],
                "updatesForm": True,
            },
            "work_item_type": {
                "type": "choice",
                "choices": HARDCODED_WORK_ITEM_TYPES,
                "default": HARDCODED_WORK_ITEM_TYPES[0][0],
            },
            "name": {"type": "string"},
        }
        # rm end

    def render_label(self):
        # return self.label.format(name=self.get_integration_name())
        return self.label.format(
            name=self.get_integration_name(),
            ado_integration="ADO",
            ado_project="ADO",
            work_item_type="Issue",
        )  # rm

    def build_description(self, event, installation):
        rule_url = u"/organizations/{}/alerts/rules/{}/{}/".format(
            self.project.organization.slug, self.project.slug, self.rule.id
        )
        footer = u"\nThis ticket was automatically created by Sentry via [{}]({})".format(
            self.rule.label, absolute_uri(rule_url),
        )
        return installation.get_group_description(event.group, event) + footer

    def after(self, event, state):
        organization = self.project.organization
        integration = self.get_integration()
        installation = integration.get_installation(organization.id)
        self.data["description"] = self.build_description(event, installation)

        def create_issue(event, futures):
            """Create an Azure DevOps work item for a given event"""

            MOCK_DATA = {
                "project": "73a12a2b-19c2-4912-adb2-ec44bc53023c",
                "work_item_type": "Microsoft.VSTS.WorkItemTypes.Issue",
                "description": self.build_description(event, installation),
                "title": event.title,
            }

            # TODO check if an Azure DevOps work item already exists for the given event's issue. if it does, skip creating it
            resp = installation.create_issue(MOCK_DATA)
            ExternalIssue.objects.create(
                organization_id=organization.id,
                integration_id=integration.id,
                key=resp["key"],
                title=event.title,
                description=installation.get_group_description(event.group, event),
            )
            return

        key = u"vsts:{}".format(integration.id)
        yield self.future(create_issue, key=key)
