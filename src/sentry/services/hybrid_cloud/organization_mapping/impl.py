from typing import Any, Dict, List, Optional

from django.db import router

from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationslugreservation import OrganizationSlugReservation
from sentry.services.hybrid_cloud.organization_mapping import (
    OrganizationMappingService,
    RpcOrganizationMapping,
    RpcOrganizationMappingUpdate,
)
from sentry.services.hybrid_cloud.organization_mapping.serial import serialize_organization_mapping
from sentry.silo import unguarded_write


class DatabaseBackedOrganizationMappingService(OrganizationMappingService):
    def get(self, *, organization_id: int) -> Optional[RpcOrganizationMapping]:
        try:
            org_mapping = OrganizationMapping.objects.get(organization_id=organization_id)
        except OrganizationMapping.DoesNotExist:
            return None
        return serialize_organization_mapping(org_mapping)

    def get_many(self, *, organization_ids: List[int]) -> List[RpcOrganizationMapping]:
        org_mappings = OrganizationMapping.objects.filter(organization_id__in=organization_ids)
        return [serialize_organization_mapping(om) for om in org_mappings]

    def upsert(self, organization_id: int, update: RpcOrganizationMappingUpdate) -> None:
        update_dict: Dict[str, Any] = dict(
            name=update.name,
            status=update.status,
            slug=update.slug,
            region_name=update.region_name,
            require_2fa=update.requires_2fa,
        )
        if update.customer_id is not None:
            update_dict["customer_id"] = update.customer_id[0]

        with unguarded_write(using=router.db_for_write(OrganizationMapping)):
            OrganizationMapping.objects.update_or_create(
                organization_id=organization_id, defaults=update_dict
            )

    def delete(self, organization_id: int) -> None:
        OrganizationMapping.objects.filter(organization_id=organization_id).delete()
