# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod

from sentry.hybridcloud.rpc.resolvers import ByCellName, ByOrganizationId
from sentry.hybridcloud.rpc.service import RpcService, cell_rpc_method
from sentry.projects.services.project_key import ProjectKeyRole, RpcProjectKey
from sentry.silo.base import SiloMode


class ProjectKeyService(RpcService):
    key = "project_key"
    local_mode = SiloMode.CELL

    @classmethod
    def get_local_implementation(cls) -> "RpcService":
        from sentry.projects.services.project_key.impl import DatabaseBackedProjectKeyService

        return DatabaseBackedProjectKeyService()

    @cell_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_project_key(
        self, *, organization_id: int, project_id: int, role: ProjectKeyRole
    ) -> RpcProjectKey | None:
        pass

    @cell_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_default_project_key(
        self, *, organization_id: int, project_id: int
    ) -> RpcProjectKey | None:
        pass

    @cell_rpc_method(resolve=ByCellName())
    @abstractmethod
    def get_project_key_by_cell(
        self, *, cell_name: str, project_id: int, role: ProjectKeyRole
    ) -> RpcProjectKey | None:
        pass


project_key_service = ProjectKeyService.create_delegation()
