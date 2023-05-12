# Mixin intended to be attached to Model classes that belong to an opposing silo.
# Allows looking up and storing the organization_id and integration_id of an external
# OrganizationIntegration, and powers backfill associated with each.
from __future__ import annotations

from typing import Any


class OrganizationIntegrityBackfillMixin:
    organization_integration_id: Any
    organization_id: Any
    integration_id: Any

    def save(self, *args, **kwds) -> None:
        from sentry.services.hybrid_cloud.integration import integration_service

        if self.organization_id is None or self.integration_id is None:
            # Find the original org integration instance, backfill in the identifiers.
            org_integrations = integration_service.get_organization_integrations(
                org_integration_ids=[self.organization_integration_id],
            )
            assert org_integrations, "Could not find org integration!"
            org_integration = org_integrations[0]
            self.organization_id = org_integration.organization_id
            self.integration_id = org_integration.integration_id
        super().save(*args, **kwds)
