from __future__ import absolute_import

import logging

from django import forms

from sentry.rules.actions.base import IntegrationEventAction
from sentry.models import ExternalIssue
from sentry.utils.http import absolute_uri

logger = logging.getLogger("sentry.rules")


class JiraNotifyServiceForm(forms.Form):
    # TODO 1.0 Add form fields.

    def __init__(self, *args, **kwargs):
        super(JiraNotifyServiceForm, self).__init__(*args, **kwargs)

    def clean(self):
        return super(JiraNotifyServiceForm, self).clean()


class JiraCreateTicketAction(IntegrationEventAction):
    form_cls = JiraNotifyServiceForm
    label = u"TODO Create a {name} Jira ticket"
    prompt = "Create a Jira ticket"
    provider = "jira"
    integration_key = "jira_integration"

    def __init__(self, *args, **kwargs):
        super(JiraCreateTicketAction, self).__init__(*args, **kwargs)
        # TODO 1.1 Add form_fields
        self.form_fields = {}

    def render_label(self):
        return self.label.format(name=self.get_integration_name())

    def build_description(self, event, installation):
        rule_url = u"/organizations/{}/alerts/rules/{}/{}/".format(
            self.project.organization.slug, self.project.slug, self.rule.id
        )
        footer = u"This ticket was automatically created by Sentry via [{}|{}]".format(
            self.rule.label, absolute_uri(rule_url),
        )
        return installation.get_group_description(event.group, event) + footer

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
