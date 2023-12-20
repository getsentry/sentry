# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import List, Optional

from sentry.services.hybrid_cloud import OptionValue
from sentry.services.hybrid_cloud.auth import AuthenticationContext
from sentry.services.hybrid_cloud.filter_query import OpaqueSerializedResponse
from sentry.services.hybrid_cloud.project import (
    ProjectFilterArgs,
    RpcProject,
    RpcProjectOptionValue,
)
from sentry.services.hybrid_cloud.region import (
    ByOrganizationId,
    ByOrganizationIdAttribute,
    ByRegionName,
)
from sentry.services.hybrid_cloud.rpc import RpcService, regional_rpc_method
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.silo import SiloMode


class ProjectService(RpcService):
    key = "project"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.project.impl import DatabaseBackedProjectService

        return DatabaseBackedProjectService()

    @regional_rpc_method(resolve=ByRegionName())
    @abstractmethod
    def get_many_by_organizations(
        self,
        *,
        region_name: str,
        organization_ids: List[int],
    ) -> List[RpcProject]:
        pass

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

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_by_id(self, *, organization_id: int, id: int) -> Optional[RpcProject]:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def serialize_many(
        self,
        *,
        organization_id: int,
        filter: ProjectFilterArgs,
        as_user: Optional[RpcUser] = None,
        auth_context: Optional[AuthenticationContext] = None,
    ) -> List[OpaqueSerializedResponse]:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def create_project_for_organization(
        self,
        *,
        organization_id: int,
        project_name: str,
        platform: str,
        user_id: int,
        add_org_default_team: Optional[bool] = False,
    ) -> RpcProject:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_or_create_project_for_organization(
        self,
        *,
        organization_id: int,
        project_name: str,
        platform: str,
        user_id: int,
        add_org_default_team: Optional[bool] = False,
    ) -> RpcProject:
        pass


project_service = ProjectService.create_delegation()
