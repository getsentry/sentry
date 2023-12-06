# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from typing import Optional

from django.db import IntegrityError, router, transaction

from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.models.outbox import outbox_context
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
    ) -> RpcOrganizationMemberMapping:
        def apply_update(orm_mapping: OrganizationMemberMapping) -> None:
            adding_user = orm_mapping.user_id is None and mapping.user_id is not None
            orm_mapping.role = mapping.role
            orm_mapping.user_id = mapping.user_id
            orm_mapping.email = mapping.email
            orm_mapping.inviter_id = mapping.inviter_id
            orm_mapping.invite_status = mapping.invite_status
            orm_mapping.organizationmember_id = organizationmember_id
            orm_mapping.save()

            if adding_user:
                try:
                    user = orm_mapping.user
                except User.DoesNotExist:
                    return
                for outbox in user.outboxes_for_update():
                    outbox.save()

        orm_mapping: OrganizationMemberMapping = OrganizationMemberMapping(
            organization_id=organization_id
        )

        try:
            with outbox_context(
                transaction.atomic(using=router.db_for_write(OrganizationMemberMapping))
            ):
                orm_mapping = (
                    self._find_organization_member(
                        organization_id=organization_id,
                        organizationmember_id=organizationmember_id,
                    )
                    or orm_mapping
                )

                apply_update(orm_mapping)
                return serialize_org_member_mapping(orm_mapping)
        except IntegrityError as e:
            # Stale user id, which will happen if a cascading deletion on the user has not reached the region.
            # This is "safe" since the upsert here should be a no-op.
            if "fk_auth_user" in str(e):
                if "inviter_id" in str(e):
                    mapping.inviter_id = None
                else:
                    mapping.user_id = None
            else:
                existing = self._find_organization_member(
                    organization_id=organization_id,
                    organizationmember_id=organizationmember_id,
                )

                if existing is None:
                    raise e
                else:
                    orm_mapping = existing

            with outbox_context(
                transaction.atomic(using=router.db_for_write(OrganizationMemberMapping))
            ):
                apply_update(orm_mapping)

        return serialize_org_member_mapping(orm_mapping)

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
