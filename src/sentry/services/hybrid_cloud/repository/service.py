# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import List, Optional, cast

from sentry.constants import ObjectStatus
from sentry.services.hybrid_cloud.region import ByOrganizationId
from sentry.services.hybrid_cloud.repository import RpcRepository
from sentry.services.hybrid_cloud.rpc import RpcService, regional_rpc_method
from sentry.silo import SiloMode


class RepositoryService(RpcService):
    key = "repository"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.repository.impl import DatabaseBackedRepositoryService

        return DatabaseBackedRepositoryService()

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_repositories(
        self,
        *,
        organization_id: int,
        integration_id: Optional[int] = None,
        providers: Optional[List[str]] = None,
        has_integration: Optional[bool] = None,
        has_provider: Optional[bool] = None,
        status: Optional[ObjectStatus] = None,
    ) -> List[RpcRepository]:
        pass


repository_service = cast(RepositoryService, RepositoryService.create_delegation())
