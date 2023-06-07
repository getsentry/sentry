# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import cast

from sentry.services.hybrid_cloud import OptionValue
from sentry.services.hybrid_cloud.project import RpcProject, RpcProjectOptionValue
from sentry.services.hybrid_cloud.region import ByOrganizationIdAttribute
from sentry.services.hybrid_cloud.rpc import RpcService, regional_rpc_method
from sentry.silo import SiloMode


class ProjectService(RpcService):
    key = "project"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.project.impl import DatabaseBackedProjectService

        return DatabaseBackedProjectService()

    @regional_rpc_method(resolve=ByOrganizationIdAttribute("project"))
    @abstractmethod
    def get_option(self, *, project: RpcProject, key: str) -> RpcProjectOptionValue:
        pass

    @regional_rpc_method(resolve=ByOrganizationIdAttribute("project"))
    @abstractmethod
    def update_option(self, *, project: RpcProject, key: str, value: OptionValue) -> bool:
        pass

    @regional_rpc_method(resolve=ByOrganizationIdAttribute("project"))
    @abstractmethod
    def delete_option(self, *, project: RpcProject, key: str) -> None:
        pass


project_service = cast(ProjectService, ProjectService.create_delegation())
