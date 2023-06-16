# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import Optional, cast

from sentry.services.hybrid_cloud.project_key import ProjectKeyRole, RpcProjectKey
from sentry.services.hybrid_cloud.region import UnimplementedRegionResolution
from sentry.services.hybrid_cloud.rpc import RpcService, regional_rpc_method
from sentry.silo import SiloMode


class ProjectKeyService(RpcService):
    key = "project_key"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> "RpcService":
        from sentry.services.hybrid_cloud.project_key.impl import DatabaseBackedProjectKeyService

        return DatabaseBackedProjectKeyService()

    @regional_rpc_method(resolve=UnimplementedRegionResolution())
    @abstractmethod
    def get_project_key(self, *, project_id: str, role: ProjectKeyRole) -> Optional[RpcProjectKey]:
        pass


project_key_service: ProjectKeyService = cast(
    ProjectKeyService, ProjectKeyService.create_delegation()
)
