# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import Any, List, Optional

from sentry.services.hybrid_cloud.region import ByOrganizationId
from sentry.services.hybrid_cloud.repository import RpcRepository
from sentry.services.hybrid_cloud.repository.model import RpcCreateRepository
from sentry.services.hybrid_cloud.rpc import RpcService, regional_rpc_method
from sentry.services.hybrid_cloud.user.model import RpcUser
from sentry.silo import SiloMode


class RepositoryService(RpcService):
    key = "repository"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.repository.impl import DatabaseBackedRepositoryService

        return DatabaseBackedRepositoryService()

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def serialize_repository(
        self,
        *,
        organization_id: int,
        id: int,
        as_user: Optional[RpcUser] = None,
    ) -> Optional[Any]:
        """
        Attempts to serialize a given repository.  Note that this can be None if the repository is already deleted
        in the corresponding region silo.
        """
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_repositories(
        self,
        *,
        organization_id: int,
        integration_id: Optional[int] = None,
        external_id: Optional[int] = None,
        providers: Optional[List[str]] = None,
        has_integration: Optional[bool] = None,
        has_provider: Optional[bool] = None,
        status: Optional[int] = None,
    ) -> List[RpcRepository]:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_repository(self, *, organization_id: int, id: int) -> Optional[RpcRepository]:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def create_repository(
        self, *, organization_id: int, create: RpcCreateRepository
    ) -> Optional[RpcRepository]:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def update_repository(self, *, organization_id: int, update: RpcRepository) -> None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def reinstall_repositories_for_integration(
        self, *, organization_id: int, integration_id: int, provider: str
    ) -> None:
        """
        Reinstalls all repositories associated with the given integration by marking them as active.
        """
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def disable_repositories_for_integration(
        self, *, organization_id: int, integration_id: int, provider: str
    ) -> None:
        """
        Disables all repositories associated with the given integration by marking them as disabled.
        Code owners and code mappings will not be changed.
        """
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def disassociate_organization_integration(
        self,
        *,
        organization_id: int,
        organization_integration_id: int,
        integration_id: int,
    ) -> None:
        """
        Disassociates all repositories for an organization integration.
        This will also delete code owners, and code mapping associated with matching repositories.
        """
        pass


repository_service = RepositoryService.create_delegation()
