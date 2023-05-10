# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import Optional, cast

from sentry.models import OrganizationMember
from sentry.services.hybrid_cloud.organizationmember_mapping import (
    RpcOrganizationMemberMapping,
    RpcOrganizationMemberMappingUpdate,
)
from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
from sentry.silo import SiloMode


class OrganizationMemberMappingService(RpcService):
    key = "organizationmember_mapping"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.organizationmember_mapping.impl import (
            DatabaseBackedOrganizationMemberMappingService,
        )

        return DatabaseBackedOrganizationMemberMappingService()

    @rpc_method
    @abstractmethod
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
        pass

    def create_with_organization_member(
        self, *, org_member: OrganizationMember
    ) -> RpcOrganizationMemberMapping:
        return self.create_mapping(
            organizationmember_id=org_member.id,
            organization_id=org_member.organization_id,
            role=org_member.role,
            user_id=org_member.user_id,
            email=org_member.email,
            inviter_id=org_member.inviter_id,
            invite_status=org_member.invite_status,
        )

    @rpc_method
    @abstractmethod
    def update_with_organization_member(
        self,
        *,
        organizationmember_id: int,
        organization_id: int,
        rpc_update_org_member: RpcOrganizationMemberMappingUpdate,
    ) -> RpcOrganizationMemberMapping:
        pass

    @rpc_method
    @abstractmethod
    def delete_with_organization_member(
        self,
        *,
        organizationmember_id: int,
        organization_id: int,
    ) -> None:
        pass


def impl_with_db() -> OrganizationMemberMappingService:
    from sentry.services.hybrid_cloud.organizationmember_mapping.impl import (
        DatabaseBackedOrganizationMemberMappingService,
    )

    return DatabaseBackedOrganizationMemberMappingService()


organizationmember_mapping_service: OrganizationMemberMappingService = cast(
    OrganizationMemberMappingService, OrganizationMemberMappingService.create_delegation()
)
