# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import Union, cast

from sentry.services.hybrid_cloud.project import RpcProject
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
    def set_option(self, *, project: RpcProject, key: str, value: Union[str, int, bool]) -> None:
        pass


project_service = cast(ProjectService, ProjectService.create_delegation())
