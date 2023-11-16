# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import List, Optional

from sentry.services.hybrid_cloud.project_key import ProjectKeyRole, RpcProjectKey
from sentry.services.hybrid_cloud.region import ByOrganizationId, ByRegionName
from sentry.services.hybrid_cloud.rpc import RpcService, regional_rpc_method
from sentry.silo import SiloMode


class ProjectKeyService(RpcService):
    key = "project_key"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> "RpcService":
        from sentry.services.hybrid_cloud.project_key.impl import DatabaseBackedProjectKeyService

        return DatabaseBackedProjectKeyService()

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_project_key(
        self, *, organization_id: int, project_id: str, role: ProjectKeyRole
    ) -> Optional[RpcProjectKey]:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_default_project_key(
        self, *, organization_id: int, project_id: str
    ) -> Optional[RpcProjectKey]:
        pass

    @regional_rpc_method(resolve=ByRegionName())
    @abstractmethod
    def get_project_key_by_region(
        self, *, region_name: str, project_id: str, role: ProjectKeyRole
    ) -> Optional[RpcProjectKey]:
        pass

    @regional_rpc_method(resolve=ByRegionName())
    @abstractmethod
    def get_project_keys_by_region(
        self,
        *,
        region_name: str,
        project_ids: List[str],
        role: ProjectKeyRole,
    ) -> List[RpcProjectKey]:
        pass


project_key_service = ProjectKeyService.create_delegation()
