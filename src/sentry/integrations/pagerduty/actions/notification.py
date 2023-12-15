from __future__ import annotations

import logging
from typing import Optional, Sequence, Tuple

import sentry_sdk

from sentry.integrations.pagerduty.actions import PagerDutyNotifyServiceForm
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
        oi = self.get_organization_integration()
        if not oi:
            return None
        for pds in oi.config.get("pagerduty_services", []):
            if str(pds["id"]) == str(self.get_option("service")):
                return pds
        return None

    def after(self, event, state, notification_uuid: Optional[str] = None):
        integration = self.get_integration()
        log_context = {
            "organization_id": self.project.organization_id,
            "integration_id": self.get_option("account"),
            "service": self.get_option("service"),
        }
        if not integration:
            # integration removed but rule still exists
            logger.info("pagerduty.org_integration_missing", extra=log_context)
            return

        service = self._get_service()
        if not service:
            logger.info("pagerduty.service_missing", extra=log_context)
            return

        def send_notification(event, futures):
            installation = integration.get_installation(self.project.organization_id)
            try:
                client = installation.get_keyring_client(self.get_option("service"))
            except Exception as e:
                sentry_sdk.capture_exception(e)
                return

            try:
                resp = client.send_trigger(event, notification_uuid=notification_uuid)
            except ApiError as e:
                self.logger.info(
                    "rule.fail.pagerduty_trigger",
                    extra={
                        "error": str(e),
                        "service_name": service["service_name"],
                        "service_id": service["id"],
                        "project_id": event.project_id,
                        "event_id": event.event_id,
                    },
                )
                raise e
            rules = [f.rule for f in futures]
            rule = rules[0] if rules else None
            self.record_notification_sent(event, str(service["id"]), rule, notification_uuid)

            # TODO(meredith): Maybe have a generic success log statements for
            # first-party integrations similar to plugin `notification.dispatched`
            self.logger.info(
                "rule.success.pagerduty_trigger",
                extra={
                    "status_code": resp.status_code,
                    "project_id": event.project_id,
                    "event_id": event.event_id,
                    "service_name": service["service_name"],
                    "service_id": service["id"],
                },
            )

        key = f"pagerduty:{integration.id}:{service['id']}"
        yield self.future(send_notification, key=key)

    def get_services(self) -> Sequence[Tuple[int, str]]:
        from sentry.services.hybrid_cloud.integration import integration_service

        organization_integrations = integration_service.get_organization_integrations(
            providers=[self.provider], organization_id=self.project.organization_id
        )
        return [
            (v["id"], v["service_name"])
            for oi in organization_integrations
            for v in oi.config.get("pagerduty_services", [])
        ]

    def render_label(self):
        s = self._get_service()
        if s:
            service_name = s["service_name"]
        else:
            service_name = "[removed]"

        return self.label.format(account=self.get_integration_name(), service=service_name)

    def get_form_instance(self):
        return self.form_cls(
            self.data,
            integrations=self.get_integrations(),
            services=self.get_services(),
        )
