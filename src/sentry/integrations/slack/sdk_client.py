from slack_sdk import WebClient

from sentry.models.integrations import Integration
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.silo.base import SiloMode


class SlackSdkClient(WebClient):
    def __init__(self, integration_id: int):
        integration = None
        if SiloMode.get_current_mode() == SiloMode.REGION:
            integration = integration_service.get_integration(integration_id=integration_id)
        else:  # control or monolith (local)
            integration = Integration.objects.filter(id=integration_id).first()

        if integration is None:
            raise ValueError(f"Integration with id {integration_id} not found")

        access_token = integration.metadata.get("access_token")
        if not access_token:
            raise ValueError(f"Missing token for integration with id {integration_id}")

        # TODO: missing from old SlackClient: verify_ssl, logging_context
        super().__init__(token=access_token)
