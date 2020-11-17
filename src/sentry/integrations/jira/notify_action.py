from __future__ import absolute_import

import logging
import six

from django import forms
from django.utils.translation import ugettext_lazy as _

from sentry.integrations.jira.utils import (
    transform_jira_fields_to_form_fields,
    transform_jira_choices_to_strings,
)
from sentry.models import ExternalIssue
from sentry.models.integration import Integration
from sentry.rules.actions.base import TicketEventAction
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.utils.http import absolute_uri

logger = logging.getLogger("sentry.rules")


class JiraNotifyServiceForm(forms.Form):
    jira_integration = forms.ChoiceField(choices=(), widget=forms.Select())

    def __init__(self, *args, **kwargs):
        integrations = [(i.id, i.name) for i in kwargs.pop("integrations")]
        super(JiraNotifyServiceForm, self).__init__(*args, **kwargs)

        if integrations:
            self.fields["jira_integration"].initial = integrations[0][0]

        self.fields["jira_integration"].choices = integrations
        self.fields["jira_integration"].widget.choices = self.fields["jira_integration"].choices


class JiraCreateTicketAction(TicketEventAction):
    form_cls = JiraNotifyServiceForm
    label = u"""Create a Jira ticket in the {jira_integration} account"""
    prompt = "Create a Jira ticket"
    provider = "jira"
    integration_key = "jira_integration"

    def __init__(self, *args, **kwargs):
        super(JiraCreateTicketAction, self).__init__(*args, **kwargs)
        integration_choices = [(i.id, i.name) for i in self.get_integrations()]

        if not self.get_integration_id() and integration_choices:
            self.data[self.integration_key] = integration_choices[0][0]

        self.form_fields = {
            "jira_integration": {
                "choices": integration_choices,
                "initial": six.text_type(self.get_integration_id()),
                "type": "choice",
                "updatesForm": True,
            }
        }

        dynamic_fields = self.get_dynamic_form_fields()
        if dynamic_fields:
            self.form_fields.update(dynamic_fields)
            self.label = self.get_label_form(dynamic_fields)

    @staticmethod
    def get_label_form(data):
        """
        Get the rule as a string. Use human-readable values when available and
        construct the the label by parts because there are so many optional
        fields.

        :return: String
        """

        labels = ["Create a Jira ticket in the {jira_integration} account"]

        if data.get("project"):
            labels.append("and {project} project")
        if data.get("issuetype"):
            labels.append("of type {issuetype}")
        if data.get("components"):
            labels.append("with components {components}")
        if data.get("duedate"):
            labels.append("and due date {duedate}")
        if data.get("fixVersions"):
            labels.append("with fixVersions {fixVersions}")
        if data.get("assignee"):
            labels.append("assigned to {assignee}")
        if data.get("reporter"):
            labels.append("reported by {reporter}")
        if data.get("labels"):
            labels.append("with the labels {labels}")
        if data.get("priority"):
            labels.append("priority {priority}")

        return " ".join(labels)

    def render_label(self):
        # Make a copy of data.
        kwargs = transform_jira_choices_to_strings(self.form_fields, self.data)

        # Replace with "removed" if the integration was uninstalled.
        kwargs.update({"jira_integration": self.get_integration_name()})

        # Only add values when they exist.
        return self.get_label_form(self.data).format(**kwargs)

    def get_dynamic_form_fields(self):
        """
        Either get the dynamic form fields cached on the DB or make an API call
        to Jira to get them for the selected integration. If both fail, return `None`.

        :return: Django form fields dictionary
        """
        if "dynamic_form_fields" in self.data:
            return self.data["dynamic_form_fields"]

        try:
            integration = self.get_integration()
        except Integration.DoesNotExist:
            pass
        else:
            installation = integration.get_installation(self.project.organization.id)
            if installation:
                try:
                    fields = installation.get_create_issue_config_no_params()
                except IntegrationError as e:
                    # TODO log when the API call fails.
                    logger.info(e)
                else:
                    dynamic_form_fields = transform_jira_fields_to_form_fields(fields)
                    self.data["dynamic_form_fields"] = dynamic_form_fields
                    # TODO should I wipe out the rest of the data?
                    return dynamic_form_fields
        return None

    def clean(self):
        cleaned_data = super(JiraCreateTicketAction, self).clean()

        jira_integration = cleaned_data.get("jira_integration")
        try:
            Integration.objects.get(id=jira_integration)
        except Integration.DoesNotExist:
            raise forms.ValidationError(
                _("Jira integration is a required field.",), code="invalid",
            )

    def generate_footer(self, rule_url):
        return u"This ticket was automatically created by Sentry via [{}|{}]".format(
            self.rule.label, absolute_uri(rule_url),
        )

    def after(self, event, state):
        organization = self.project.organization
        integration = self.get_integration()
        installation = integration.get_installation(organization.id)

        self.data["title"] = event.title
        self.data["description"] = self.build_description(event, installation)

        def create_issue(event, futures):
            """Create the Jira ticket for a given event"""

            # TODO check if a Jira ticket already exists for the given event's issue. if it does, skip creating it
            resp = installation.create_issue(self.data)
            ExternalIssue.objects.create(
                organization_id=organization.id,
                integration_id=integration.id,
                key=resp["key"],
                title=event.title,
                description=installation.get_group_description(event.group, event),
            )
            return

        key = u"jira:{}".format(integration.id)
        yield self.future(create_issue, key=key)
