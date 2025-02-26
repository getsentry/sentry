from __future__ import annotations

import logging

from sentry.integrations.base import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.pipeline.views.base import PipelineView

# It's safe to ignore this entire file, it's just setup for our new fake integration

# This metadata does nothing more than flag what features are supported by this integration.
# This is for UI display only.
metadata = IntegrationMetadata(
    description="Fake Log Integration",
    features=[
        FeatureDescription("Fake Alert Rule Functionality", IntegrationFeatures.ALERT_RULE),
    ],
    author="The Sentry Team",
    noun="Log",
    issue_url="",
    source_url="",
    aspects={},
)


class FakeLogIntegration(IntegrationInstallation):
    # Very basic integration, just logs via a fake client
    def get_client(self) -> FakeIntegrationClient:
        return FakeIntegrationClient(self.model)

    def logme(
        self,
        message: str,
        target_identifier: str,
        notification_uuid: str | None = None,
    ):
        client = self.get_client()
        client.log(message, target_identifier, notification_uuid)


class FakeIntegrationClient:
    logger = logging.getLogger("sentry.integrations.fake-log")

    # Common pattern of tight coupling between the integration and the client
    def __init__(self, integration: RpcIntegration | Integration):
        self.integration = integration

    def log(self, message: str, target_identifier: str, notification_uuid: str | None = None):
        self.logger.info(
            message,
            extra={
                "target_identifier": target_identifier,
                "notification_uuid": notification_uuid,
                "integration_id": self.integration.id,
            },
        )


class FakeLogIntegrationProvider(IntegrationProvider):
    key = "fake-log"
    name = "Fake Log"
    metadata = metadata
    integration_cls = FakeLogIntegration

    def get_pipeline_views(self) -> list[PipelineView]:
        return []

    def build_integration(self, state):
        pass
