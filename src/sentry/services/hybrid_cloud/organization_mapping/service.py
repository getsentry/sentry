# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import Optional, cast

from sentry.services.hybrid_cloud.organization_mapping import (
    RpcOrganizationMapping,
    RpcOrganizationMappingUpdate,
)
from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
from sentry.silo import SiloMode


class OrganizationMappingService(RpcService):
    key = "organization_mapping"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.organization_mapping.impl import (
            DatabaseBackedOrganizationMappingService,
        )

        return DatabaseBackedOrganizationMappingService()

    @rpc_method
    @abstractmethod
    def create(
        self,
        *,
        organization_id: int,
        slug: str,
        name: str,
        region_name: str,
        idempotency_key: Optional[str] = "",
        customer_id: Optional[str],
        user: Optional[int] = None,
    ) -> RpcOrganizationMapping:
        """
        This method returns a new or recreated OrganizationMapping object.
        If a record already exists with the same slug, the organization_id can only be
        updated IF the idempotency key is identical.
        Will raise IntegrityError if the slug already exists.

        :param organization_id:
        The org id to create the slug for
        :param slug:
        A slug to reserve for this organization
        :param customer_id:
        A unique per customer billing identifier
        :return:
        """
        pass

    def close(self) -> None:
        pass

    @rpc_method
    @abstractmethod
    def update(self, *, organization_id: int, update: RpcOrganizationMappingUpdate) -> None:
        pass

    @rpc_method
    @abstractmethod
    def verify_mappings(self, *, organization_id: int, slug: str) -> None:
        pass

    @rpc_method
    @abstractmethod
    def delete(self, *, organization_id: int) -> None:
        pass


organization_mapping_service: OrganizationMappingService = cast(
    OrganizationMappingService, OrganizationMappingService.create_delegation()
)
