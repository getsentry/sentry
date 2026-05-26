from __future__ import annotations

import abc
from typing import Any

from django.utils.translation import gettext_lazy as _
from pydantic import BaseModel

from sentry.api.utils import generate_locality_url
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.coding_agent.client import CodingAgentClient
from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
from sentry.integrations.services.integration import integration_service
from sentry.seer.autofix.utils import CodingAgentState
from sentry.utils.http import absolute_uri

# Default metadata for coding agent integrations
DEFAULT_CODING_AGENT_METADATA = IntegrationMetadata(
    description="AI coding agent integration.",
    features=[
        FeatureDescription(
            "Launch AI coding agents from Seer.",
            IntegrationFeatures.CODING_AGENT,
        ),
    ],
    author="The Sentry Team",
    noun=_("Agent"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Coding%20Agent%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/coding_agent",
    aspects={},
)


class CodingAgentIntegrationProvider(IntegrationProvider, abc.ABC):
    """Abstract base provider for coding agent integrations."""

    can_add = True
    allow_multiple = False
    setup_dialog_config = {"width": 600, "height": 700}
    requires_feature_flag = True
    features = frozenset([IntegrationFeatures.CODING_AGENT])

    @abc.abstractmethod
    def get_agent_name(self) -> str:
        """Return the name of the coding agent."""
        pass

    @abc.abstractmethod
    def get_agent_key(self) -> str:
        """Return the unique key for the coding agent."""
        pass


class CodingAgentIntegration(IntegrationInstallation, abc.ABC):
    """Abstract base class for coding agent integrations."""

    @abc.abstractmethod
    def get_client(self) -> CodingAgentClient:
        """Get API client for the coding agent."""
        pass

    def _persist_metadata(self, metadata: BaseModel, **kwargs: Any) -> None:
        """Persist updated metadata to the database and local model."""
        integration_service.update_integration(
            integration_id=self.model.id, metadata=metadata.dict(), **kwargs
        )
        self.model.metadata = metadata.dict()

    def get_webhook_url(self) -> str:
        """Generate webhook URL for this integration."""
        return absolute_uri(
            f"/extensions/{self.model.provider}/organizations/{self.organization_id}/webhook/",
            url_prefix=generate_locality_url(),
        )

    def launch(self, request: CodingAgentLaunchRequest) -> CodingAgentState:
        """Launch coding agent with webhook callback URL."""
        webhook_url = self.get_webhook_url()
        client = self.get_client()

        return client.launch(
            webhook_url=webhook_url,
            request=request,
        )
