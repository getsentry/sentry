"""
Used for notifying a *specific* plugin
"""
from __future__ import absolute_import

from django import forms
from sentry.constants import ObjectStatus

from sentry.rules.actions.base import EventAction
from sentry.models import Integration, PagerDutyService, PagerDutyServiceProject
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

        try:
            service_project = PagerDutyServiceProject.objects.get(
                project_id=self.project.id,
            )
        except PagerDutyServiceProject.DoesNotExist:
            service_project = None

        if services:
            self.fields["service"].initial = service_project.service_id or services[0][0]

        self.fields["service"].choices = services
        self.fields["service"].widget.choices = self.fields["service"].choices


class PagerDutyNotifyServiceAction(EventAction):
    label = "Send a notification to PagerDuty account {account} and service {service}"

    def __init__(self, *args, **kwargs):
        super(PagerDutyNotifyServiceAction, self).__init__(*args, **kwargs)
        self.form_fields = {
            "account": {
                "type": "choice",
                "choices": [(i.id, i.name) for i in self.get_integrations()],
            },
            "service": {
                "type": "choice",
                "choices": self.get_services(),
            },

        }

    def after(self, event, state):
        try:
            integration = Integration.objects.get(
                provider="pagerduty",
                organizations=self.project.organization,
                status=ObjectStatus.VISIBLE,
            )
        except Integration.DoesNotExist:
            # integration removed but rule still exists
            return

        try:
            service = PagerDutyService.objects.get(pk=self.get_option("service"))
        except PagerDutyService.DoesNotExist:
            return

        def send_notification(event, futures):
            client = PagerDutyClient(integration_key=service.integration_key)
            client.send_trigger(event)

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
        integrations = Integration.objects.filter(
            provider="pagerduty",
            organizations=self.project.organization,
            status=ObjectStatus.VISIBLE,
        )
        services = []
        for integration in integrations:
            service_list = PagerDutyService.objects.filter(
                organization_integration_id__in=integration.organizationintegration_set.all(),
            ).values_list('id', 'service_name')
            services += (service_list)
        return services

    def get_form_instance(self):
        return self.form_cls(
            self.data, integrations=self.get_integrations(), services=self.get_services(),
        )
