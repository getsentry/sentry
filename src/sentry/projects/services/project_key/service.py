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

    @cell_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def create_project_key(
        self, *, organization_id: int, project_id: int, label: str | None = None
    ) -> RpcProjectKey | None:
        """Create a new ProjectKey under the given project.

        ``label`` is the display name shown in the Keys list UI; when
        None or empty, ``ProjectKey.save()`` auto-generates a random
        petname rather than leaving the label blank. Returns the
        serialized key, or None if the project does not exist under
        the given organization.

        Callers are responsible for creating any audit log entries --
        this RPC does not write them on their behalf.
        """
        pass

    @cell_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def delete_project_key(self, *, organization_id: int, project_id: int, public_key: str) -> bool:
        """Delete a ProjectKey by its public-key value.

        Scoped by ``organization_id + project_id + public_key`` so a
        stolen or malformed key value cannot delete keys on an
        unrelated project. Only keys with ``use_case=UseCase.USER`` are
        matched -- internal keys (PROFILING, TEMPEST, DEMO) are
        protected, matching the HTTP endpoint's ``for_request`` filter.

        Returns True if a matching key existed and was deleted, False
        otherwise (idempotent no-op).

        Callers are responsible for creating any audit log entries --
        this RPC does not write them on their behalf.
        """
        pass


project_key_service = ProjectKeyService.create_delegation()
