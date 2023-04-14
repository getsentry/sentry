import logging

from sentry.models.integrations.integration import Integration

logger = logging.getLogger(__name__)


class ProcessSlackRequest:
    def request(self, flow):
        integration = Integration.objects.get(id=4)
        access_token = (
            integration.metadata.get("user_access_token") or integration.metadata["access_token"]
        )
        if access_token is None:
            logger.error(
                "Slack credentials not found",
                extra={"integration_id": integration.id, "path": flow.request.path},
            )
            flow.kill()
        flow.request.headers["Authorization"] = f"Bearer {access_token}"


addons = [ProcessSlackRequest()]
