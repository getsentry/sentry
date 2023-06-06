# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from typing import Optional

from django.db import transaction

from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.services.hybrid_cloud.organizationmember_mapping import (
    OrganizationMemberMappingService,
    RpcOrganizationMemberMapping,
    RpcOrganizationMemberMappingUpdate,
)
from sentry.services.hybrid_cloud.organizationmember_mapping.serial import (
    serialize_org_member_mapping,
)


class DatabaseBackedOrganizationMemberMappingService(OrganizationMemberMappingService):
    def upsert_mapping(
        self,
        *,
        organization_id: int,
        organizationmember_id: int,
        mapping: RpcOrganizationMemberMappingUpdate,
    ) -> RpcOrganizationMemberMapping:
        with transaction.atomic():
            existing = self._find_organization_member(
                organization_id=organization_id,
                organizationmember_id=organizationmember_id,
            )

            if not existing:
                existing = OrganizationMemberMapping.objects.create(organization_id=organization_id)

            existing.role = mapping.role
            existing.user_id = mapping.user_id
            existing.email = mapping.email
            existing.inviter_id = mapping.inviter_id
            existing.invite_status = mapping.invite_status
            existing.organizationmember_id = organizationmember_id

            existing.save()
            return serialize_org_member_mapping(existing)

    def _find_organization_member(
        self,
        organization_id: int,
        organizationmember_id: int,
    ) -> Optional[OrganizationMemberMapping]:
        return OrganizationMemberMapping.objects.filter(
            organization_id=organization_id, organizationmember_id=organizationmember_id
        ).first()

    def delete(
        self,
        *,
        organization_id: int,
        organizationmember_id: int,
    ) -> None:
        org_member_map = self._find_organization_member(
            organization_id=organization_id,
            organizationmember_id=organizationmember_id,
        )
        if org_member_map:
            org_member_map.delete()

    def close(self) -> None:
        pass
