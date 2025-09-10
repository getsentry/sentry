from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.models.organizationmapping import OrganizationMapping
from sentry.utils import json


@dataclass
class OrganizationSummary:
    name: str
    slug: str
    id: int
    region: str
    github_integration_id: int
    organization_integration_id: int

    @classmethod
    def from_organization_mapping(
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

    def to_json(self) -> str:
        return json.dumps(asdict(self))
