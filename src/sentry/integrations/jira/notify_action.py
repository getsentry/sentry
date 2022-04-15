from __future__ import annotations

import logging
from typing import Any

from django import forms
from django.utils.translation import ugettext_lazy as _

from sentry.models import Integration
from sentry.rules.actions.base import IntegrationNotifyServiceForm, TicketEventAction
from sentry.utils.http import absolute_uri

logger = logging.getLogger("sentry.rules")


class JiraNotifyServiceForm(IntegrationNotifyServiceForm):
    def clean(self) -> dict[str, Any] | None:
        cleaned_data = super().clean()

        integration = cleaned_data.get("integration")
        try:
            Integration.objects.get(id=integration)
        except Integration.DoesNotExist:
            raise forms.ValidationError(_("Jira integration is a required field."), code="invalid")
        return cleaned_data


class JiraCreateTicketAction(TicketEventAction):
    id = "sentry.integrations.jira.notify_action.JiraCreateTicketAction"
    label = "Create a Jira issue in {integration} with these "
    ticket_type = "a Jira issue"
    link = "https://docs.sentry.io/product/integrations/issue-tracking/jira/#issue-sync"
    provider = "jira"
    form_cls = JiraNotifyServiceForm

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)

        fix_versions = self.data.get("fixVersions")
        if fix_versions and not isinstance(fix_versions, list):
            self.data["fixVersions"] = [fix_versions]

    def generate_footer(self, rule_url: str) -> str:
        return "This ticket was automatically created by Sentry via [{}|{}]".format(
            self.rule.label,
            absolute_uri(rule_url),
        )

    def translate_integration(self, integration: Integration) -> str:
        name = integration.metadata.get("domain_name", integration.name)
        return name.replace(".atlassian.net", "")
