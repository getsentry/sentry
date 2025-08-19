from sentry.constants import ObjectStatus
from sentry.incidents.action_handlers import DefaultActionHandler
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.incidents.models.incident import IncidentStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.twilio.integration import TwilioApiClient


@AlertRuleTriggerAction.register_type(
    "twilio",
    AlertRuleTriggerAction.Type.TWILIO,
    [AlertRuleTriggerAction.TargetType.SPECIFIC],
)
class TwilioActionHandler(DefaultActionHandler):
    @property
    def provider(self) -> str:
        return "twilio"

    def send_alert(
        self,
        metric_value: int | float,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ):
        # This pattern of retrieving the integration is common across alerting functions
        result = integration_service.organization_context(
            organization_id=self.incident.organization_id, integration_id=self.action.integration_id
        )
        integration = result.integration
        org_integration = result.organization_integration
        # This handling is also common, but not always consistent
        if (
            org_integration is None
            or integration is None
            or integration.status != ObjectStatus.ACTIVE
        ):
            # Integration removed, but rule is still active.
            return False
        identifier = self.action.target_identifier

        assert identifier is not None, "Identifier is required for twilio integration"

        # Tight coupling between the notifier and _client_ is unfortunately really common
        # We don't either don't have enough context to fully instantiate an integration installation class with the data we have
        # or we were too lazy to go through the effort to do so
        client = TwilioApiClient(integration)
        client.send_sms(identifier, self.incident.title, notification_uuid)

        return True
