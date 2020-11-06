from __future__ import absolute_import

import logging

from django import forms

from sentry.rules.actions.base import IntegrationEventAction
from sentry.models import ExternalIssue

logger = logging.getLogger("sentry.rules")


class JiraNotifyServiceForm(forms.Form):
    jira_project = forms.ChoiceField(choices=(), widget=forms.Select())
    issue_type = forms.ChoiceField(choices=(), widget=forms.Select())

    def __init__(self, *args, **kwargs):
        projects_list = [(i.id, i.name) for i in kwargs.pop("integrations")]
        super(JiraNotifyServiceForm, self).__init__(*args, **kwargs)

        if projects_list:
            self.fields["jira_project"].initial = projects_list[0][0]

        self.fields["jira_project"].choices = projects_list
        self.fields["jira_project"].widget.choices = self.fields["jira_project"].choices

        self.fields["issuetype"].choices = HARDCODED_ISSUE_TYPES
        self.fields["issuetype"].widget.choices = self.fields["issuetype"].choices

    def clean(self):
        return super(JiraNotifyServiceForm, self).clean()


# TODO instead of hard-coding things, lets automatically select the first integration.
HARDCODED_ISSUE_TYPES = [
    ("Bug", "Bug"),
    ("Issue", "Issue"),
    ("Task", "Task"),
]


class JiraCreateTicketAction(IntegrationEventAction):
    form_cls = JiraNotifyServiceForm
    label = u"TODO Create a {jira_integration} {jira_project} Jira ticket, name: {name} type: {issuetype}!"
    prompt = "Create a Jira ticket"
    provider = "jira"
    integration_key = "jira_integration"

    def __init__(self, *args, **kwargs):
        super(JiraCreateTicketAction, self).__init__(*args, **kwargs)
        all_integrations = self.get_integrations()
        integration_choices = [(i.id, i.name) for i in all_integrations]

        self.form_fields = {
            "jira_integration": {
                "type": "choice",
                "choices": integration_choices,
                "default": integration_choices[0][0],
                "updatesForm": True,
            },
            "jira_project": {
                "type": "choice",
                "choices": integration_choices,
                "default": integration_choices[0][0],
                "updatesForm": True,
            },
            "issuetype": {
                "type": "choice",
                "choices": HARDCODED_ISSUE_TYPES,
                "default": HARDCODED_ISSUE_TYPES[0][0],
            },
            "name": {"type": "string"},
        }

    def render_label(self):
        return self.label.format(
            name=self.get_integration_name(),
            jira_integration="JIRA",
            jira_project="JIRA",
            issue_type="Bug",
        )

    def after(self, event, state):
        integration = self.get_integration()
        installation = integration.get_installation(self.project.organization.id)

        self.data["title"] = event.title
        self.data["description"] = installation.get_group_description(event.group, event)

        def create_issue(event, futures):
            """Create the Jira ticket for a given event"""

            # TODO check if a Jira ticket already exists for the given event's issue. if it does, skip creating it
            resp = installation.create_issue(self.data)
            ExternalIssue.objects.create(
                organization_id=self.project.organization.id,
                integration_id=integration.id,
                key=resp["key"],
            )
            return

        key = u"jira:{}".format(integration.id)
        yield self.future(create_issue, key=key)
