# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud service classes and data models are
# defined, because we want to reflect on type annotations and avoid forward references.

from typing import Optional, cast

from django.db import transaction

from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.services.hybrid_cloud.organizationmember_mapping import (
    OrganizationMemberMappingService,
    RpcOrganizationMemberMapping,
    RpcOrganizationMemberMappingUpdate,
)


class DatabaseBackedOrganizationMemberMappingService(OrganizationMemberMappingService):
    def create_mapping(
        self,
        *,
        organizationmember_id: int,
        organization_id: int,
        role: str,
        user_id: Optional[int] = None,
        email: Optional[str] = None,
        inviter_id: Optional[int] = None,
        invite_status: Optional[int] = None,
    ) -> RpcOrganizationMemberMapping:
        assert (user_id is None and email) or (
            user_id and email is None
        ), "Must set either user or email"
        with transaction.atomic():
            query = OrganizationMemberMapping.objects.filter(organization_id=organization_id)
            if user_id is not None:
                query = query.filter(user_id=user_id)
            else:
                query = query.filter(email=email)

            if query.exists():
                org_member_mapping = query.get()
                org_member_mapping.update(
                    organizationmember_id=organizationmember_id,
                    organization_id=organization_id,
                    user_id=user_id,
                    email=email,
                    role=role,
                    inviter_id=inviter_id,
                    invite_status=invite_status,
                )
            else:
                org_member_mapping = OrganizationMemberMapping.objects.create(
                    organizationmember_id=organizationmember_id,
                    organization_id=organization_id,
                    user_id=user_id,
                    email=email,
                    role=role,
                    inviter_id=inviter_id,
                    invite_status=invite_status,
                )
        return self._serialize_rpc(org_member_mapping)

    def update_with_organization_member(
        self,
        *,
        organizationmember_id: int,
        organization_id: int,
        rpc_update_org_member: RpcOrganizationMemberMappingUpdate,
    ) -> RpcOrganizationMemberMapping:
        try:
            org_member_map = OrganizationMemberMapping.objects.get(
                organization_id=organization_id,
                organizationmember_id=organizationmember_id,
            )
            org_member_map.update(**rpc_update_org_member.dict())
            return self._serialize_rpc(org_member_map)
        except OrganizationMemberMapping.DoesNotExist:
            return self.create_mapping(
                organizationmember_id=organizationmember_id,
                organization_id=organization_id,
                **rpc_update_org_member.dict(),
            )

    def delete_with_organization_member(
        self,
        *,
        organizationmember_id: int,
        organization_id: int,
    ) -> None:
        OrganizationMemberMapping.objects.filter(
            organization_id=organization_id,
            organizationmember_id=organizationmember_id,
        ).delete()

    def close(self) -> None:
        pass

    def _serialize_rpc(
        self, org_member_mapping: OrganizationMemberMapping
    ) -> RpcOrganizationMemberMapping:
        return cast(
            RpcOrganizationMemberMapping,
            RpcOrganizationMemberMapping.serialize_by_field_name(org_member_mapping),
        )
