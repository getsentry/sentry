from __future__ import annotations

from typing import Any, Mapping

from django import forms
from django.utils.translation import gettext_lazy as _

from sentry.services.hybrid_cloud.integration import integration_service
from sentry.types.integrations import ExternalProviders


def _validate_int_field(field: str, cleaned_data: Mapping[str, Any]) -> int | None:
    value_option = cleaned_data.get(field)
    if value_option is None:
        return None

    try:
        return int(value_option)
    except ValueError:
        raise forms.ValidationError(_(f"Invalid {field}"), code="invalid")


class PagerDutyNotifyServiceForm(forms.Form):
    """Used for notifying a *specific* plugin."""

    account = forms.ChoiceField(choices=(), widget=forms.Select())
    service = forms.ChoiceField(required=False, choices=(), widget=forms.Select())

    def __init__(self, *args, **kwargs):
        integrations = [(i.id, i.name) for i in kwargs.pop("integrations")]
        services = kwargs.pop("services")

        super().__init__(*args, **kwargs)
        if integrations:
            self.fields["account"].initial = integrations[0][0]

        self.fields["account"].choices = integrations
        self.fields["account"].widget.choices = self.fields["account"].choices

        if services:
            self.fields["service"].initial = services[0][0]

        self.fields["service"].choices = services
        self.fields["service"].widget.choices = self.fields["service"].choices

    def _validate_service(self, service_id: int, integration_id: int) -> None:
        params = {
            "account": dict(self.fields["account"].choices).get(integration_id),
            "service": dict(self.fields["service"].choices).get(service_id),
        }

        org_integrations = integration_service.get_organization_integrations(
            integration_id=integration_id,
            providers=[ExternalProviders.PAGERDUTY.name],
        )

        if not any(
            pds
            for oi in org_integrations
            for pds in oi.config.get("pagerduty_services", [])
            if pds["id"] == service_id
        ):
            # We need to make sure that the service actually belongs to that integration,
            # meaning that it belongs under the appropriate account in PagerDuty.
            raise forms.ValidationError(
                _(
                    'The service "%(service)s" has not been granted access in the %(account)s Pagerduty account.'
                ),
                code="invalid",
                params=params,
            )

    def clean(self) -> dict[str, Any] | None:
        cleaned_data = super().clean()

        integration_id = _validate_int_field("account", cleaned_data)
        service_id = _validate_int_field("service", cleaned_data)

        if service_id:
            self._validate_service(service_id, integration_id)

        return cleaned_data
