from __future__ import annotations

from typing import Any, Mapping, Sequence

from django import forms
from django.utils.translation import ugettext_lazy as _

from sentry.constants import ObjectStatus
from sentry.models import Integration, PagerDutyService
from sentry.rules.actions.base import IntegrationEventAction
from sentry.shared_integrations.exceptions import ApiError

from .client import PagerDutyClient


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

    def _validate_service(self, service_id: int, integration_id: int | None) -> None:
        params = {
            "account": dict(self.fields["account"].choices).get(integration_id),
            "service": dict(self.fields["service"].choices).get(service_id),
        }

        try:
            service = PagerDutyService.objects.get(id=service_id)
        except PagerDutyService.DoesNotExist:
            raise forms.ValidationError(
                _('The service "%(service)s" does not exist in the %(account)s Pagerduty account.'),
                code="invalid",
                params=params,
            )

        if service.organization_integration.integration_id != integration_id:
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


class PagerDutyNotifyServiceAction(IntegrationEventAction):
    form_cls = PagerDutyNotifyServiceForm
    label = "Send a notification to PagerDuty account {account} and service {service}"
    prompt = "Send a PagerDuty notification"
    provider = "pagerduty"
    integration_key = "account"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.form_fields = {
            "account": {
                "type": "choice",
                "choices": [(i.id, i.name) for i in self.get_integrations()],
            },
            "service": {"type": "choice", "choices": self.get_services()},
        }

    def _get_service(self):
        return PagerDutyService.objects.get(id=self.get_option("service"))

    def after(self, event, state):
        try:
            integration = self.get_integration()
        except Integration.DoesNotExist:
            # integration removed but rule still exists
            return

        try:
            service = self._get_service()
        except PagerDutyService.DoesNotExist:
            return

        def send_notification(event, futures):
            client = PagerDutyClient(integration_key=service.integration_key)
            try:
                resp = client.send_trigger(event)
            except ApiError as e:
                self.logger.info(
                    "rule.fail.pagerduty_trigger",
                    extra={
                        "error": str(e),
                        "service_name": service.service_name,
                        "service_id": service.id,
                    },
                )
                raise e

            # TODO(meredith): Maybe have a generic success log statements for
            # first-party integrations similar to plugin `notification.dispatched`
            self.logger.info(
                "rule.success.pagerduty_trigger",
                extra={
                    "status_code": resp.status_code,
                    "project_id": event.project_id,
                    "event_id": event.event_id,
                    "service_id": service.id,
                },
            )

        key = f"pagerduty:{integration.id}"
        yield self.future(send_notification, key=key)

    def get_services(self) -> Sequence[PagerDutyService]:
        return list(
            PagerDutyService.objects.filter(
                organization_integration__organization=self.project.organization,
                organization_integration__integration__provider=self.provider,
                organization_integration__integration__status=ObjectStatus.VISIBLE,
            ).values_list("id", "service_name")
        )

    def render_label(self):
        try:
            service_name = self._get_service().service_name
        except PagerDutyService.DoesNotExist:
            service_name = "[removed]"

        return self.label.format(account=self.get_integration_name(), service=service_name)

    def get_form_instance(self):
        return self.form_cls(
            self.data, integrations=self.get_integrations(), services=self.get_services()
        )
