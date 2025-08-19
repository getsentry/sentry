from __future__ import annotations

import logging
from collections.abc import Generator, Sequence
from typing import Any

from sentry.eventstore.models import GroupEvent
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.services.integration import integration_service
from sentry.rules.actions import IntegrationEventAction
from sentry.rules.base import CallbackFuture, RuleFuture
from sentry.utils import metrics

from .form import TwilioConfigurationForm

logger = logging.getLogger(__name__)


class TwilioNotifyServiceAction(IntegrationEventAction):
    id = "sentry.integrations.twilio.notify_action.TwilioNotifyServiceAction"
    label = "Send an SMS notification via Twilio to {sms_to} using account {account}"
    prompt = "Send an SMS via Twilio"
    provider = "twilio"
    integration_key = "account"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.form_fields = {
            "account": {
                "type": "choice",
                "choices": [(i.id, i.name) for i in self.get_integrations()],
            },
            "sms_to": {
                "type": "string",
                "placeholder": "+1234567890",
                "label": "SMS Recipients",
                "help": "Phone numbers to send SMS to (comma separated)",
                "required": True,
            },
        }

    def after(
        self, event: GroupEvent, notification_uuid: str | None = None
    ) -> Generator[CallbackFuture]:
        if event.group is None:
            return None

        integration = self.get_integration()
        if not integration:
            logger.warning(
                "twilio.action.no_integration",
                extra={
                    "organization_id": self.project.organization_id,
                    "project_id": self.project.id,
                },
            )
            return None

        install = integration.get_installation(self.project.organization_id)

        # Get recipients from rule configuration or use default from integration
        sms_to = self.get_option("sms_to")
        if not sms_to:
            sms_to = integration.metadata.get("sms_to", [])
            if isinstance(sms_to, list):
                sms_to = ",".join(sms_to)

        if not sms_to:
            logger.warning(
                "twilio.action.no_recipients",
                extra={
                    "organization_id": self.project.organization_id,
                    "project_id": self.project.id,
                    "integration_id": integration.id,
                },
            )
            return None

        # Format SMS body
        body = self._build_sms_body(event)

        # Send SMS
        recipients = [r.strip() for r in sms_to.split(",") if r.strip()]

        def send_sms(event: GroupEvent, futures: Sequence[RuleFuture]):
            try:
                install.send_sms(to=recipients, body=body)
                metrics.incr(
                    "integrations.twilio.sms_sent",
                    tags={
                        "organization_id": self.project.organization_id,
                        "project_id": self.project.id,
                    },
                )
            except Exception as e:
                logger.exception(
                    "twilio.action.send_failed",
                    extra={
                        "organization_id": self.project.organization_id,
                        "project_id": self.project.id,
                        "integration_id": integration.id,
                        "error": str(e),
                    },
                )
                metrics.incr(
                    "integrations.twilio.sms_failed",
                    tags={
                        "organization_id": self.project.organization_id,
                        "project_id": self.project.id,
                    },
                )

        yield self.future(send_sms)

    def _build_sms_body(self, event: GroupEvent) -> str:  # noqa: ARG002
        """Build the SMS message body."""
        group = event.group
        project = self.project

        level = group.get_level_display().upper()
        title = event.title[:50]  # Truncate title to keep SMS short

        # Build a concise SMS message (max 160 chars)
        body = f"[Sentry] {project.name} {level}: {title}"

        # Add link if space permits
        link = group.get_absolute_url()
        if len(body) + len(link) + 3 < 160:  # 3 for " - "
            body = f"{body} - {link}"

        return body

    def get_integration(self) -> IntegrationInstallation | None:
        """Get the Twilio integration for this project."""
        integrations = integration_service.get_integrations(
            organization_id=self.project.organization_id,
            providers=[self.provider],
        )

        if integrations:
            return integrations[0]

        return None

    def render_label(self) -> str:
        return self.label.format(
            sms_to=self.get_option("sms_to"),
            account=self.get_integration_name(),
        )

    def get_form_instance(self) -> TwilioConfigurationForm:
        return TwilioConfigurationForm(self.data, integrations=self.get_integrations())
