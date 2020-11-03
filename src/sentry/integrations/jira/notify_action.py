from __future__ import absolute_import

import logging

from django import forms

from sentry.rules.actions.base import IntegrationEventAction

from sentry.models.integration import Integration

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

        self.fields["issue_type"].choices = HARDCODED_ISSUE_TYPES
        self.fields["issue_type"].widget.choices = self.fields["issue_type"].choices

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
    label = u"TODO Create a {jira_integration} {jira_project} Jira ticket, name: {name} type: {issue_type}!"
    prompt = "Create a Jira ticket"
    provider = "jira"
    integration_key = "jira_project"

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
            "issue_type": {
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
        """Create the Jira ticket for a given event"""

        MOCK_DATA = {
            "priority": "1",
            "labels": "fuzzy",
            "description": "Sentry Issue: [GOODGIRLHB-1|https://meowlificent.ngrok.io/organizations/sentry/issues/506/?referrer=jira_integration]\n\n{code}\nTypeError: Object [object Object] has no method 'updateFrom'\n  at poll (../../sentry/scripts/views.js:389:46)\n  at merge (../../sentry/scripts/views.js:268:16)\n  at member (../../sentry/scripts/views.js:283:50)\n\nThis is an example JavaScript exception\n{code}",
            u"title": u"TypeError: Object [object Object] has no method 'updateFrom'",
            "reporter": "5ab0069933719f2a50168cab",
            "fixVersions": "",
            "project": "10000",
            "assignee": "5ab0069933719f2a50168cab",
            "components": "",
            "issuetype": "10002",
        }
        # TODO replace mock data with data we get from the form

        # integration = self.get_integration()
        integration = Integration.objects.get(
            provider="jira"
        )  # this is obviously brittle but get_integration wasn't finding it TODO make this less stupid
        installation = integration.get_installation(self.project.organization.id)
        # call integration.py's create_issue given the form field data
        # this fn takes the form data and cleans it up into the format Jira wants
        # then hits the API to create an issue

        # TODO check if a Jira ticket already exists for the given event's issue. if it does, skip creating it
        return installation.create_issue(MOCK_DATA)
