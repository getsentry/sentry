from __future__ import annotations

from collections.abc import Mapping
from dataclasses import asdict, dataclass
from typing import int, Any

from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.models.organizationmapping import OrganizationMapping
from sentry.utils import json

# Default request type for webhook details
DEFAULT_REQUEST_TYPE = "webhook_sentry_github"


@dataclass
class OrganizationSummary:
    name: str
    slug: str
    id: int
    region: str
    github_integration_id: int
    organization_integration_id: int

    @classmethod
    def from_organization_mapping_and_integration(
        cls, organization_mapping: OrganizationMapping, org_integration: OrganizationIntegration
    ) -> OrganizationSummary:
        return cls(
            name=organization_mapping.name,
            slug=organization_mapping.slug,
            id=organization_mapping.organization_id,
            region=organization_mapping.region_name,
            github_integration_id=org_integration.integration_id,
            organization_integration_id=org_integration.id,
        )


@dataclass
class WebhookDetails:
    organizations: list[OrganizationSummary]
    webhook_body: dict[str, Any]
    webhook_headers: Mapping[str, str]
    integration_provider: str
    region: str
    event_type: str = "github"
    app_id: int | None = None
    request_type: str = DEFAULT_REQUEST_TYPE

    def to_json(self) -> str:
        return json.dumps(asdict(self))
