# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from typing import Optional

from django.db import IntegrityError, router, transaction

from sentry.models import outbox_context
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.models.user import User
from sentry.services.hybrid_cloud.organizationmember_mapping import (
    OrganizationMemberMappingService,
    RpcOrganizationMemberMapping,
    RpcOrganizationMemberMappingUpdate,
)
from sentry.services.hybrid_cloud.organizationmember_mapping.serial import (
    serialize_org_member_mapping,
)
from sentry.silo import unguarded_write


class DatabaseBackedOrganizationMemberMappingService(OrganizationMemberMappingService):
    def upsert_mapping(
        self,
        *,
        organization_id: int,
        organizationmember_id: int,
        mapping: RpcOrganizationMemberMappingUpdate,
    ) -> Optional[RpcOrganizationMemberMapping]:
        def apply_update(existing: OrganizationMemberMapping) -> None:
            adding_user = existing.user_id is None and mapping.user_id is not None
            existing.role = mapping.role
            existing.user_id = mapping.user_id
            existing.email = mapping.email
            existing.inviter_id = mapping.inviter_id
            existing.invite_status = mapping.invite_status
            existing.organizationmember_id = organizationmember_id
            existing.save()

            if adding_user:
                try:
                    user = existing.user
                except User.DoesNotExist:
                    return
                for outbox in user.outboxes_for_update():
                    outbox.save()

        try:
            with outbox_context(
                transaction.atomic(using=router.db_for_write(OrganizationMemberMapping))
            ):
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

            if existing is None:
                raise e

            with outbox_context(
                transaction.atomic(using=router.db_for_write(OrganizationMemberMapping))
            ):
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
            with unguarded_write(using=router.db_for_write(OrganizationMemberMapping)):
                org_member_map.delete()
