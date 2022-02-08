import logging

from django import forms
from django.utils.translation import ugettext_lazy as _

from sentry.models import Integration
from sentry.rules.actions.base import TicketEventAction
from sentry.utils.http import absolute_uri
from sentry.web.decorators import transaction_start

logger = logging.getLogger("sentry.rules")


class JiraCreateTicketAction(TicketEventAction):
    label = "Create a Jira issue in {integration} with these "
    ticket_type = "a Jira issue"
    link = "https://docs.sentry.io/product/integrations/project-mgmt/jira/#issue-sync"
    provider = "jira"
    integration_key = "integration"

    def clean(self):
        cleaned_data = super().clean()

        integration = cleaned_data.get(self.integration_key)
        try:
            Integration.objects.get(id=integration)
        except Integration.DoesNotExist:
            raise forms.ValidationError(
                _(
                    "Jira integration is a required field.",
                ),
                code="invalid",
            )

    def generate_footer(self, rule_url):
        return "This ticket was automatically created by Sentry via [{}|{}]".format(
            self.rule.label,
            absolute_uri(rule_url),
        )

    def fix_data_for_issue(self):
        # HACK to get fixVersion in the correct format
        if self.data.get("fixVersions"):
            if not isinstance(self.data["fixVersions"], list):
                self.data["fixVersions"] = [self.data["fixVersions"]]
        return self.data

    def translate_integration(self, integration):
        name = integration.metadata.get("domain_name", integration.name)
        return name.replace(".atlassian.net", "")

    @transaction_start("JiraCreateTicketAction.after")
    def after(self, event, state):
        self.fix_data_for_issue()
        yield super().after(event, state)
