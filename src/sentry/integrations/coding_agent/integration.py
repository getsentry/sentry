from __future__ import annotations

import abc

from django.utils.translation import gettext_lazy as _

from sentry.integrations.base import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.coding_agent.client import CodingAgentClient
from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
from sentry.organizations.absolute_url import generate_organization_url
from sentry.organizations.services.organization import organization_service
from sentry.seer.autofix.utils import CodingAgentState
from sentry.shared_integrations.exceptions import IntegrationError
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

    def get_webhook_url(self) -> str:
        """Generate webhook URL for this integration."""
        provider = self.model.provider

        org_context = organization_service.get_organization_by_id(
            id=self.organization_id, include_projects=False, include_teams=False
        )
        org_slug = (
            org_context.organization.slug if org_context and org_context.organization else None
        )

        if not org_slug:
            raise IntegrationError(
                f"Missing organization slug for organization_id={self.organization_id}"
            )

        return absolute_uri(
            f"/extensions/{provider}/organizations/{self.organization_id}/webhook/",
            url_prefix=generate_organization_url(org_slug),
        )

    def launch(self, request: CodingAgentLaunchRequest) -> CodingAgentState:
        """Launch coding agent with webhook callback URL."""
        webhook_url = self.get_webhook_url()
        client = self.get_client()

        return client.launch(
            webhook_url=webhook_url,
            request=request,
        )
