# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud service classes and data models are
# defined, because we want to reflect on type annotations and avoid forward references.

from dataclasses import fields
from typing import Optional

from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.services.hybrid_cloud.organizationmember_mapping import (
    OrganizationMemberMappingService,
    RpcOrganizationMemberMapping,
)


class DatabaseBackedOrganizationMemberMappingService(OrganizationMemberMappingService):
    def create_mapping(
        self,
        *,
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
        org_member_mapping, _created = OrganizationMemberMapping.objects.update_or_create(
            organization_id=organization_id,
            user_id=user_id,
            email=email,
            defaults={
                "role": role,
                "inviter_id": inviter_id,
                "invite_status": invite_status,
            },
        )
        return self._serialize_rpc(org_member_mapping)

    def create_with_organization_member(
        self, org_member: OrganizationMember
    ) -> RpcOrganizationMemberMapping:
        return self.create_mapping(
            organization_id=org_member.organization_id,
            role=org_member.role,
            user_id=org_member.user_id,
            email=org_member.email,
            inviter_id=org_member.inviter_id,
            invite_status=org_member.invite_status,
        )

    def close(self) -> None:
        pass

    def _serialize_rpc(
        self, org_member_mapping: OrganizationMemberMapping
    ) -> RpcOrganizationMemberMapping:
        args = {
            field.name: getattr(org_member_mapping, field.name)
            for field in fields(RpcOrganizationMemberMapping)
            if hasattr(org_member_mapping, field.name)
        }
        return RpcOrganizationMemberMapping(**args)
