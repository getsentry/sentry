from sentry.constants import ObjectStatus
from sentry.incidents.action_handlers import DefaultActionHandler
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.incidents.models.incident import IncidentStatus
from sentry.integrations.fake_log_integration.log_provider import FakeIntegrationClient
from sentry.integrations.services.integration import integration_service


@AlertRuleTriggerAction.register_type(
    "fake_log",
    AlertRuleTriggerAction.Type.FAKE_LOG,
    [AlertRuleTriggerAction.TargetType.SPECIFIC],
)
class FakeLogActionHandler(DefaultActionHandler):
    @property
    def provider(self) -> str:
        return "fake_log"

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

        assert identifier is not None, "Identifier is required for fake log integration"

        # Tight coupling between the notifier and _client_ is unfortunately really common
        # We don't either don't have enough context to fully instantiate an integration installation class with the data we have
        # or we were too lazy to go through the effort to do so
        client = FakeIntegrationClient(integration)
        client.log(self.incident.title, identifier, notification_uuid)

        return True
