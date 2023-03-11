# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud service classes and data models are
# defined, because we want to reflect on type annotations and avoid forward references.

from dataclasses import fields
from typing import Optional

from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.services.hybrid_cloud.organizationmember_mapping import (
    OrganizationMemberMappingService,
    RpcOrganizationMemberMapping,
)


class DatabaseBackedOrganizationMemberMappingService(OrganizationMemberMappingService):
    def create(
        self,
        *,
        organization_id: int,
        role: str,
        user_id: Optional[int] = None,
        email: Optional[str] = None,
        inviter_id: Optional[int] = None,
        invite_status: Optional[int] = None,
        idempotency_key: Optional[str] = "",
    ) -> RpcOrganizationMemberMapping:
        assert user_id or email, "Must set either user or email"
        if idempotency_key:
            org_member_mapping, _created = OrganizationMemberMapping.objects.update_or_create(
                organization_id=organization_id,
                user_id=user_id,
                email=email,
                idempotency_key=idempotency_key,
                defaults={
                    "role": role,
                    "inviter_id": inviter_id,
                    "invite_status": invite_status,
                },
            )
        else:
            org_member_mapping = OrganizationMemberMapping.objects.create(
                organization_id=organization_id,
                role=role,
                user_id=user_id,
                email=email,
                inviter_id=inviter_id,
                invite_status=invite_status,
                idempotency_key=idempotency_key,
            )
        return self._serialize_rpc(org_member_mapping)

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
