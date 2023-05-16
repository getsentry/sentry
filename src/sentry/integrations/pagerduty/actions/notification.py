from __future__ import annotations

import logging
from typing import Sequence

from sentry.integrations.pagerduty.actions import PagerDutyNotifyServiceForm
from sentry.integrations.pagerduty.client import PagerDutyClient
from sentry.models import PagerDutyService
from sentry.rules.actions import IntegrationEventAction
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger("sentry.integrations.pagerduty")


class PagerDutyNotifyServiceAction(IntegrationEventAction):
    id = "sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction"
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
        integration = self.get_integration()
        if not integration:
            logger.exception("Integration removed, however, the rule still refers to it.")
            # integration removed but rule still exists
            return

        try:
            service = self._get_service()
        except PagerDutyService.DoesNotExist:
            logger.exception("The PagerDuty does not exist anymore while integration does.")
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
                        "project_id": event.project_id,
                        "event_id": event.event_id,
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
                    "service_name": service.service_name,
                    "service_id": service.id,
                },
            )

        key = f"pagerduty:{integration.id}:{service.id}"
        yield self.future(send_notification, key=key)

    def get_services(self) -> Sequence[PagerDutyService]:
        from sentry.services.hybrid_cloud.integration import integration_service

        organization_integrations = integration_service.get_organization_integrations(
            providers=[self.provider], organization_id=self.project.organization_id
        )
        integration_ids = [oi.integration_id for oi in organization_integrations]

        return [
            service
            for service in PagerDutyService.objects.filter(
                organization_id=self.project.organization_id, integration_id__in=integration_ids
            ).values_list("id", "service_name")
        ]

    def render_label(self):
        try:
            service_name = self._get_service().service_name
        except PagerDutyService.DoesNotExist:
            service_name = "[removed]"

        return self.label.format(account=self.get_integration_name(), service=service_name)

    def get_form_instance(self):
        return self.form_cls(
            self.data,
            integrations=self.get_integrations(),
            services=self.get_services(),
        )
