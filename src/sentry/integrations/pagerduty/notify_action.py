"""
Used for notifying a *specific* plugin
"""
from __future__ import absolute_import

import six
from django import forms
from django.utils.translation import ugettext_lazy as _

from sentry.constants import ObjectStatus
from sentry.rules.actions.base import EventAction
from sentry.models import Integration, OrganizationIntegration, PagerDutyService
from sentry.shared_integrations.exceptions import ApiError
from .client import PagerDutyClient


class PagerDutyNotifyServiceForm(forms.Form):
    account = forms.ChoiceField(choices=(), widget=forms.Select())
    service = forms.ChoiceField(required=False, choices=(), widget=forms.Select())

    def __init__(self, *args, **kwargs):
        integrations = [(i.id, i.name) for i in kwargs.pop("integrations")]
        services = kwargs.pop("services")

        super(PagerDutyNotifyServiceForm, self).__init__(*args, **kwargs)
        if integrations:
            self.fields["account"].initial = integrations[0][0]

        self.fields["account"].choices = integrations
        self.fields["account"].widget.choices = self.fields["account"].choices

        if services:
            self.fields["service"].initial = services[0][0]

        self.fields["service"].choices = services
        self.fields["service"].widget.choices = self.fields["service"].choices

    def clean(self):
        cleaned_data = super(PagerDutyNotifyServiceForm, self).clean()

        integration_id = cleaned_data.get("account")
        service_id = cleaned_data.get("service")

        service = PagerDutyService.objects.get(id=service_id)

        # need to make sure that the service actually belongs to that integration - meaning
        # that it belongs under the appropriate account in PagerDuty
        if not service.organization_integration.integration_id == int(integration_id):
            params = {
                "account": dict(self.fields["account"].choices).get(int(integration_id)),
                "service": dict(self.fields["service"].choices).get(int(service_id)),
            }

            raise forms.ValidationError(
                _(
                    'The service "%(service)s" does not exist or has not been granted access in the %(account)s Pagerduty account.'
                ),
                code="invalid",
                params=params,
            )

        return cleaned_data


class PagerDutyNotifyServiceAction(EventAction):
    form_cls = PagerDutyNotifyServiceForm
    label = "Send a notification to PagerDuty account {account} and service {service}"
    prompt = "Send a PagerDuty notification"

    def __init__(self, *args, **kwargs):
        super(PagerDutyNotifyServiceAction, self).__init__(*args, **kwargs)
        self.form_fields = {
            "account": {
                "type": "choice",
                "choices": [(i.id, i.name) for i in self.get_integrations()],
            },
            "service": {"type": "choice", "choices": self.get_services()},
        }

    def is_enabled(self):
        return self.get_integrations().exists()

    def after(self, event, state):
        integration_id = self.get_option("account")
        service_id = self.get_option("service")

        try:
            integration = Integration.objects.get(
                id=integration_id,
                provider="pagerduty",
                organizations=self.project.organization,
                status=ObjectStatus.VISIBLE,
            )
        except Integration.DoesNotExist:
            # integration removed but rule still exists
            return

        try:
            service = PagerDutyService.objects.get(pk=service_id)
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
                        "error": six.text_type(e),
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

        key = u"pagerduty:{}".format(integration.id)
        yield self.future(send_notification, key=key)

    def get_integrations(self):
        integrations = Integration.objects.filter(
            provider="pagerduty",
            organizations=self.project.organization,
            status=ObjectStatus.VISIBLE,
        )

        return integrations

    def get_services(self):
        organization = self.project.organization
        integrations = Integration.objects.filter(
            provider="pagerduty", organizations=organization, status=ObjectStatus.VISIBLE
        )
        services = []
        for integration in integrations:
            service_list = PagerDutyService.objects.filter(
                organization_integration_id=OrganizationIntegration.objects.get(
                    organization=organization, integration=integration
                )
            ).values_list("id", "service_name")
            services += service_list
        return services

    def render_label(self):
        try:
            integration_name = Integration.objects.get(
                provider="pagerduty",
                organizations=self.project.organization,
                id=self.get_option("account"),
            ).name
        except Integration.DoesNotExist:
            integration_name = "[removed]"

        try:
            service_name = PagerDutyService.objects.get(id=self.get_option("service")).service_name
        except PagerDutyService.DoesNotExist:
            service_name = "[removed]"

        return self.label.format(account=integration_name, service=service_name)

    def get_form_instance(self):
        return self.form_cls(
            self.data, integrations=self.get_integrations(), services=self.get_services()
        )
