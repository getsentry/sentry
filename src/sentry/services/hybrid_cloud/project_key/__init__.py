# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud service classes and data models are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from enum import Enum
from typing import Any, Optional, cast

from sentry.services.hybrid_cloud import RpcModel
from sentry.services.hybrid_cloud.region import UnimplementedRegionResolution
from sentry.services.hybrid_cloud.rpc import RpcService, regional_rpc_method
from sentry.silo import SiloMode


class ProjectKeyRole(Enum):
    store = "store"
    api = "api"

    def as_orm_role(self) -> Any:
        from sentry.models import ProjectKey

        if self == ProjectKeyRole.store:
            return ProjectKey.roles.store
        elif self == ProjectKeyRole.api:
            return ProjectKey.roles.api
        else:
            raise ValueError("Unexpected project key role enum")


class RpcProjectKey(RpcModel):
    dsn_public: str = ""


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
