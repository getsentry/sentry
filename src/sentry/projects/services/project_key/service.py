# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod

from sentry.hybridcloud.rpc.resolvers import ByOrganizationId, ByRegionName
from sentry.hybridcloud.rpc.service import RpcService, regional_rpc_method
from sentry.projects.services.project_key import ProjectKeyRole, RpcProjectKey
from sentry.silo.base import SiloMode


class ProjectKeyService(RpcService):
    key = "project_key"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> "RpcService":
        from sentry.projects.services.project_key.impl import DatabaseBackedProjectKeyService

        return DatabaseBackedProjectKeyService()

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_project_key(
        self, *, organization_id: int, project_id: str, role: ProjectKeyRole
    ) -> RpcProjectKey | None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_default_project_key(
        self, *, organization_id: int, project_id: str
    ) -> RpcProjectKey | None:
        pass

    @regional_rpc_method(resolve=ByRegionName())
    @abstractmethod
    def get_project_key_by_region(
        self, *, region_name: str, project_id: str, role: ProjectKeyRole
    ) -> RpcProjectKey | None:
        pass

    @regional_rpc_method(resolve=ByRegionName())
    @abstractmethod
    def get_project_keys_by_region(
        self,
        *,
        region_name: str,
        project_ids: list[str],
        role: ProjectKeyRole,
    ) -> list[RpcProjectKey]:
        pass


project_key_service = ProjectKeyService.create_delegation()
