# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod

from sentry.hybridcloud.rpc.service import RpcService, rpc_method
from sentry.hybridcloud.services.organization_mapping import (
    RpcOrganizationMapping,
    RpcOrganizationMappingUpdate,
)
from sentry.silo.base import SiloMode
from sentry.users.services.user.model import RpcUser


class OrganizationMappingService(RpcService):
    key = "organization_mapping"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.hybridcloud.services.organization_mapping.impl import (
            DatabaseBackedOrganizationMappingService,
        )

        return DatabaseBackedOrganizationMappingService()

    @rpc_method
    @abstractmethod
    def get(self, *, organization_id: int) -> RpcOrganizationMapping | None:
        pass

    @rpc_method
    @abstractmethod
    def get_by_slug(self, *, slug: str) -> RpcOrganizationMapping | None:
        pass

    @rpc_method
    @abstractmethod
    def get_owners(self, *, organization_id: int) -> list[RpcUser]:
        pass

    @rpc_method
    @abstractmethod
    def get_many(self, *, organization_ids: list[int]) -> list[RpcOrganizationMapping]:
        """Find all organizations with one of the given IDs.

        In contrast to the "get" methods on OrganizationService, this method is
        region-independent. It can find organizations from different regions in the
        same query.
        """

    @rpc_method
    @abstractmethod
    def upsert(self, *, organization_id: int, update: RpcOrganizationMappingUpdate) -> None:
        pass

    @rpc_method
    @abstractmethod
    def delete(self, *, organization_id: int) -> None:
        pass


organization_mapping_service = OrganizationMappingService.create_delegation()
