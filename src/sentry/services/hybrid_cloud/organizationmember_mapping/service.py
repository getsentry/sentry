# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod

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
    def upsert_mapping(
        self,
        *,
        organization_id: int,
        organizationmember_id: int,
        mapping: RpcOrganizationMemberMappingUpdate,
    ) -> RpcOrganizationMemberMapping:
        pass

    @rpc_method
    @abstractmethod
    def delete(
        self,
        *,
        organization_id: int,
        organizationmember_id: int,
    ) -> None:
        pass


def impl_with_db() -> OrganizationMemberMappingService:
    from sentry.services.hybrid_cloud.organizationmember_mapping.impl import (
        DatabaseBackedOrganizationMemberMappingService,
    )

    return DatabaseBackedOrganizationMemberMappingService()


organizationmember_mapping_service = OrganizationMemberMappingService.create_delegation()
