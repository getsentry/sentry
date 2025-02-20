# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod

from sentry.auth.services.auth import AuthenticationContext
from sentry.hybridcloud.rpc import OptionValue
from sentry.hybridcloud.rpc.filter_query import OpaqueSerializedResponse
from sentry.hybridcloud.rpc.resolvers import (
    ByOrganizationId,
    ByOrganizationIdAttribute,
    ByRegionName,
)
from sentry.hybridcloud.rpc.service import RpcService, regional_rpc_method
from sentry.projects.services.project import ProjectFilterArgs, RpcProject, RpcProjectOptionValue
from sentry.projects.services.project.model import ProjectUpdateArgs
from sentry.silo.base import SiloMode
from sentry.users.services.user import RpcUser


class ProjectService(RpcService):
    key = "project"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.projects.services.project.impl import DatabaseBackedProjectService

        return DatabaseBackedProjectService()

    @regional_rpc_method(resolve=ByRegionName())
    @abstractmethod
    def get_many_by_organizations(
        self,
        *,
        region_name: str,
        organization_ids: list[int],
    ) -> list[RpcProject]:
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
    def get_by_id(self, *, organization_id: int, id: int) -> RpcProject | None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_by_slug(self, *, organization_id: int, slug: str) -> RpcProject | None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_by_external_id(self, *, organization_id: int, external_id: str) -> RpcProject | None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def serialize_many(
        self,
        *,
        organization_id: int,
        filter: ProjectFilterArgs,
        as_user: RpcUser | None = None,
        auth_context: AuthenticationContext | None = None,
    ) -> list[OpaqueSerializedResponse]:
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
        add_org_default_team: bool | None = False,
        external_id: str | None = None,
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
        add_org_default_team: bool | None = False,
        external_id: str | None = None,
    ) -> RpcProject:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def update_project(
        self,
        *,
        organization_id: int,
        project_id: int,
        attrs: ProjectUpdateArgs,
    ) -> RpcProject:
        pass


project_service = ProjectService.create_delegation()
