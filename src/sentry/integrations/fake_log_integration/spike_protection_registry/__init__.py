from typing import Any

from sentry.integrations.fake_log_integration.log_provider import FakeIntegrationClient
from sentry.integrations.services.integration import integration_service
from sentry.notifications.models.notificationaction import (
    ActionRegistration,
    ActionService,
    ActionTarget,
    ActionTrigger,
    NotificationAction,
)


@NotificationAction.register_action(
    trigger_type=ActionTrigger.FAKE_LOGGER_EXAMPLE.value,
    service_type=ActionService.FAKE_LOG.value,
    target_type=ActionTarget.SPECIFIC.value,
)
class FakeLogIntegrationRegistration(ActionRegistration):
    # The `fire` method on a registration handles all of the alerting
    # business logic, and takes arbitrary args/kwargs depending on the caller
    def fire(self, data: Any):
        # Our existing definitions call into functions that handle
        # this specific behavior, per-integration, so I just inlined
        # this code instead.
        result = integration_service.organization_context(
            organization_id=self.action.organization_id,
            integration_id=self.action.integration_id,
        )

        integration = result.integration
        organization_integration = result.organization_integration

        if not integration or not organization_integration:
            # Handling for an integration/org-integration pair is done per handler!
            return

        client = FakeIntegrationClient(integration)
        message = data["message"]
        target_identifier = self.action.target_identifier
        assert target_identifier is not None

        # Error handling for fake log integrations typically happens here as well.
        client.log(message, target_identifier)
