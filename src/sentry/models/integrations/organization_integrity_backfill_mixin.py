# Mixin intended to be attached to Model classes that belong to an opposing silo.
# Allows looking up and storing the organization_id and integration_id of an external
# OrganizationIntegration, and powers backfill associated with each.
from __future__ import annotations

from typing import Any, List

from sentry.services.hybrid_cloud.integration import integration_service


class OrganizationIntegrityBackfillMixin:
    organization_integration_id: Any
    organization_id: Any
    integration_id: Any

    @classmethod
    def find_all_by_org_and_integration(
        cls: Any, *, organization_id: int, integration_id: int
    ) -> List[Any]:
        inst = cls.objects.filter(
            organization_id=organization_id, integration_id=integration_id
        ).first()
        # If we've already back filled here, just use the instance directly.
        if inst is not None:
            return [inst]

        org_integration = integration_service.get_organization_integration(
            organization_id=organization_id, integration_id=integration_id
        )
        if org_integration:
            return list(cls.objects.filter(organization_integration_id=org_integration.id))
        return []

    def save(self, *args, **kwds) -> None:
        if self.organization_id is None or self.integration_id is None:
            # Find the original org integration instance, backfill in the identifiers.
            org_integrations = integration_service.get_organization_integrations(
                org_integration_ids=[self.organization_integration_id],
            )
            if org_integrations:
                org_integration = org_integrations[0]
                self.organization_id = org_integration.organization_id
                self.integration_id = org_integration.integration_id
        super().save(*args, **kwds)
