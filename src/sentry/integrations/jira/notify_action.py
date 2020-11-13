from __future__ import absolute_import

import logging

from django import forms

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
    label = u"""Create a Jira ticket in the {jira_integration} account
    and {project} project
    of type {issuetype}
    with components {components}
    and due date {duedate}
    with fixVersions {fixVersions}
    assigned to {assignee}
    reported by {reporter}
    label {labels}
    priority {priority}"""
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
                "default": self.get_integration_id(),
                "type": "choice",
                "updatesForm": True,
            }
        }

        try:
            integration = self.get_integration()
        except Integration.DoesNotExist:
            return

        installation = integration.get_installation(self.project.organization.id)
        if installation:
            try:
                fields = installation.get_create_issue_config_no_params()
            except IntegrationError as e:
                # TODO log when the API call fails.
                logger.info(e)
                return

            self.update_form_fields_from_jira_fields(fields)

    def render_label(self):
        """
        Get the rule as a string. Use human-readable values when available and
        construct the the label by parts because there are so many optional
        fields.

        :return: String
        """
        labels = ["Create a Jira ticket in the {} account".format(self.get_integration_name())]

        if self.data.get("jira_project"):
            labels.append("and {jira_project} project")
        if self.data.get("issue_type"):
            labels.append("of type {issue_type}")
        if self.data.get("components"):
            labels.append("with components {components}")
        if self.data.get("duedate"):
            labels.append("and due date {duedate}")
        if self.data.get("fixVersions"):
            labels.append("with fixVersions {fixVersions}")
        if self.data.get("assignee"):
            labels.append("assigned to {assignee}")
        if self.data.get("reporter"):
            labels.append("reported by {reporter}")
        if self.data.get("labels"):
            labels.append("with the labels {labels}")
        if self.data.get("priority"):
            labels.append("priority {priority}")

        return " ".join(labels).format(**self.data)

    def update_form_fields_from_jira_fields(self, fields_list):
        """
        The fields array from Jira doesn't exactly match the Alert Rules front
        end's expected format. Massage the field names and types and put them in a dict.

        :param fields_list: Create ticket fields from Jira as an array.
        :return: The "create ticket" fields from Jira a dict.
        """
        self.form_fields.update(
            {
                field["name"]: {
                    key: ({"select": "choice", "text": "string"}.get(value, value))
                    if key == "type"
                    else value
                    for key, value in field.items()
                    if key != "updatesForm"
                }
                for field in fields_list
                if field["name"]
            }
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
