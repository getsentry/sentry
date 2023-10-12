from typing import Any, Dict, List, Optional

from django.db import router
from sentry_sdk import capture_exception

from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationslugreservation import (
    OrganizationSlugReservation,
    OrganizationSlugReservationType,
)
from sentry.services.hybrid_cloud.organization_mapping import (
    OrganizationMappingService,
    RpcOrganizationMapping,
    RpcOrganizationMappingUpdate,
)
from sentry.services.hybrid_cloud.organization_mapping.serial import serialize_organization_mapping
from sentry.silo import unguarded_write


class OrganizationMappingConsistencyException(Exception):
    pass


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

    def _check_organization_mapping_integrity(
        self, org_id: int, update: RpcOrganizationMappingUpdate
    ) -> bool:
        if not update.slug:
            capture_exception(
                OrganizationMappingConsistencyException("Organization mapping must have a slug")
            )
            return False

        if not update.region_name:
            capture_exception(
                OrganizationMappingConsistencyException("Organization mapping must have a region")
            )
            return False

        org_slug_qs = OrganizationSlugReservation.objects.filter(
            organization_id=org_id,
        )
        org_slugs = [org_slug for org_slug in org_slug_qs]

        if len(org_slugs) == 0:
            # If there's no matching organization slug reservation, alert but don't raise an exception
            capture_exception(
                OrganizationMappingConsistencyException(
                    f"Expected an organization slug reservation for organization {org_id}, none was found"
                )
            )
            return False

        primary_slug = next(
            (
                org_slug
                for org_slug in org_slugs
                if org_slug.reservation_type == OrganizationSlugReservationType.PRIMARY.value
            ),
            None,
        )

        if primary_slug.region_name != update.region_name:
            raise OrganizationMappingConsistencyException(
                "Mismatched Slug Reservation and Organization Regions"
            )

        has_matching_slug_reservation = (
            len([org_slug for org_slug in org_slugs if org_slug.slug == update.slug]) > 0
        )

        if not has_matching_slug_reservation:
            raise OrganizationMappingConsistencyException(
                "Mismatched Slug Reservation and Organization Slugs"
            )

        return True

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

        mapping_is_valid = self._check_organization_mapping_integrity(
            org_id=organization_id, update=update
        )
        if not mapping_is_valid:
            return

        with unguarded_write(using=router.db_for_write(OrganizationMapping)):
            OrganizationMapping.objects.update_or_create(
                organization_id=organization_id, defaults=update_dict
            )

    def delete(self, organization_id: int) -> None:
        OrganizationMapping.objects.filter(organization_id=organization_id).delete()
