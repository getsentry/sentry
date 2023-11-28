from __future__ import annotations

from typing import Any

from django import forms
from django.utils.translation import gettext_lazy as _

from sentry.rules.actions import IntegrationNotifyServiceForm
from sentry.services.hybrid_cloud.integration.service import integration_service


class JiraNotifyServiceForm(IntegrationNotifyServiceForm):
    provider = "jira"

    def clean(self) -> dict[str, Any] | None:
        cleaned_data = super().clean()

        integration_id = cleaned_data.get("integration")
        integration = integration_service.get_integration(
            integration_id=integration_id, provider=self.provider
        )

        if not integration:
            raise forms.ValidationError(_("Jira integration is a required field."), code="invalid")
        return cleaned_data
