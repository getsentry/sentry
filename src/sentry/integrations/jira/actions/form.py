from __future__ import annotations

from typing import Any

from django import forms
from django.utils.translation import ugettext_lazy as _

from sentry.models import Integration
from sentry.rules.actions import IntegrationNotifyServiceForm


class JiraNotifyServiceForm(IntegrationNotifyServiceForm):
    def clean(self) -> dict[str, Any] | None:
        cleaned_data = super().clean()

        integration = cleaned_data.get("integration")
        try:
            Integration.objects.get(id=integration)
        except Integration.DoesNotExist:
            raise forms.ValidationError(_("Jira integration is a required field."), code="invalid")
        return cleaned_data
