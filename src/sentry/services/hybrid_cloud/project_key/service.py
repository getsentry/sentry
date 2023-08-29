# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import List, Optional, Tuple, cast

from sentry.services.hybrid_cloud.project import RpcProject
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

    @regional_rpc_method(resolve=ByRegionName())
    @abstractmethod
    def get_project_key_by_region(
        self, *, region_name: str, project_id: str, role: ProjectKeyRole
    ) -> Optional[RpcProjectKey]:
        pass

    @regional_rpc_method(resolve=ByRegionName())
    @abstractmethod
    def get_docsupport_data(
        self, *, region_name: str, organization_ids: List[int], role: ProjectKeyRole
    ) -> List[Tuple[int, RpcProject, RpcProjectKey]]:
        """Find all active project keys for an arbitrary set of organizations.

        This is bespoke logic for the getsentry docsupport module. The organization
        IDs generally are the set of all orgs for which the user viewing the docs
        page has "project:read" permissions.

        The return value is an unordered collection of
            (organization_id, project, project_key)
        tuples. The first value is always a member of the `organization_ids` argument
        and represents the organization that the project belongs to. There is one
        entry for each project key; projects with no keys will not appear.
        """


project_key_service: ProjectKeyService = cast(
    ProjectKeyService, ProjectKeyService.create_delegation()
)
