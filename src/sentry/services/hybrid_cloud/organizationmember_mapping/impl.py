# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from typing import Optional

from django.db import IntegrityError, transaction

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
    ) -> Optional[RpcOrganizationMemberMapping]:
        def apply_update(existing: OrganizationMemberMapping) -> None:
            existing.role = mapping.role
            existing.user_id = mapping.user_id
            existing.email = mapping.email
            existing.inviter_id = mapping.inviter_id
            existing.invite_status = mapping.invite_status
            existing.organizationmember_id = organizationmember_id
            existing.save()

        try:
            with transaction.atomic():
                existing = self._find_organization_member(
                    organization_id=organization_id,
                    organizationmember_id=organizationmember_id,
                )

                if not existing:
                    existing = OrganizationMemberMapping.objects.create(
                        organization_id=organization_id
                    )

                assert existing
                apply_update(existing)
                return serialize_org_member_mapping(existing)
        except IntegrityError as e:
            # Stale user id, which will happen if a cascading deletion on the user has not reached the region.
            # This is "safe" since the upsert here should be a no-op.
            if "fk_auth_user" in str(e):
                return None

            existing = self._find_organization_member(
                organization_id=organization_id,
                organizationmember_id=organizationmember_id,
            )
            assert existing, "Failed to find conflicted org member"

            apply_update(existing)

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
