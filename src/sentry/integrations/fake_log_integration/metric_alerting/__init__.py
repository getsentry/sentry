from sentry.constants import ObjectStatus
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.incidents.models.incident import Incident, IncidentStatus
from sentry.integrations.fake_log_integration.log_provider import FakeIntegrationClient
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import ExternalProviders
from sentry.notifications.notify import register_notification_provider


@register_notification_provider(ExternalProviders.FAKE_LOG)
def send_incident_alert_notification(
    action: AlertRuleTriggerAction,
    incident: Incident,
    metric_value: float,
    new_status: IncidentStatus,
    notification_uuid: str | None = None,
) -> bool:
    # This pattern of retrieving the integration is common across alerting functions
    result = integration_service.organization_context(
        organization_id=incident.organization_id, integration_id=action.integration_id
    )
    integration = result.integration
    org_integration = result.organization_integration
    # This handling is also common, but not always consistent
    if org_integration is None or integration is None or integration.status != ObjectStatus.ACTIVE:
        # Integration removed, but rule is still active.
        return False
    identifier = action.target_identifier

    assert identifier is not None, "Identifier is required for fake log integration"

    # Tight coupling between the notifier and _client_ is unfortunately really common
    # We don't either don't have enough context to fully instantiate an integration installation class with the data we have
    # or we were too lazy to go through the effort to do so
    client = FakeIntegrationClient(integration)
    client.log(incident.title, identifier, notification_uuid)

    return True
