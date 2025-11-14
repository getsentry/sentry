from __future__ import annotations

from collections.abc import Mapping
from typing import int, Any

from django import forms
from django.utils.translation import gettext_lazy as _

from sentry.integrations.on_call.metrics import OnCallIntegrationsHaltReason, OnCallInteractionType
from sentry.integrations.pagerduty.metrics import record_event
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import ExternalProviders
from sentry.utils.forms import set_field_choices


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

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self._integrations = [(i.id, i.name) for i in kwargs.pop("integrations")]
        self._services = kwargs.pop("services")

        super().__init__(*args, **kwargs)
        if self._integrations:
            self.fields["account"].initial = self._integrations[0][0]

        set_field_choices(self.fields["account"], self._integrations)

        if self._services:
            self.fields["service"].initial = self._services[0][0]

        set_field_choices(self.fields["service"], self._services)

    def _validate_service(self, service_id: int, integration_id: int) -> None:
        with record_event(OnCallInteractionType.VALIDATE_SERVICE).capture() as lifecycle:
            params = {
                "account": dict(self._integrations).get(integration_id),
                "service": dict(self._services).get(service_id),
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
                lifecycle.record_halt(OnCallIntegrationsHaltReason.INVALID_SERVICE)
                raise forms.ValidationError(
                    _(
                        'The service "%(service)s" has not been granted access in the %(account)s Pagerduty account.'
                    ),
                    code="invalid",
                    params=params,
                )

    def clean(self) -> dict[str, Any] | None:
        cleaned_data = super().clean()
        if cleaned_data is None:
            return cleaned_data

        integration_id = _validate_int_field("account", cleaned_data)
        service_id = _validate_int_field("service", cleaned_data)

        if service_id and integration_id:
            self._validate_service(service_id, integration_id)

        return cleaned_data
