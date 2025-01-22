# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import Any

from sentry.hybridcloud.rpc.resolvers import ByOrganizationId
from sentry.hybridcloud.rpc.service import RpcService, regional_rpc_method
from sentry.integrations.services.repository import RpcRepository
from sentry.integrations.services.repository.model import RpcCreateRepository
from sentry.silo.base import SiloMode
from sentry.users.services.user.model import RpcUser


class RepositoryService(RpcService):
    key = "repository"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.integrations.services.repository.impl import DatabaseBackedRepositoryService

        return DatabaseBackedRepositoryService()

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def serialize_repository(
        self,
        *,
        organization_id: int,
        id: int,
        as_user: RpcUser | None = None,
    ) -> Any | None:
        """
        Attempts to serialize a given repository.  Note that this can be None if the repository is already deleted
        in the corresponding region silo.
        """

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_repositories(
        self,
        *,
        organization_id: int,
        integration_id: int | None = None,
        external_id: int | None = None,
        providers: list[str] | None = None,
        has_integration: bool | None = None,
        has_provider: bool | None = None,
        status: int | None = None,
    ) -> list[RpcRepository]:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_repository(self, *, organization_id: int, id: int) -> RpcRepository | None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def create_repository(
        self, *, organization_id: int, create: RpcCreateRepository
    ) -> RpcRepository | None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def update_repository(self, *, organization_id: int, update: RpcRepository) -> None:
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


repository_service = RepositoryService.create_delegation()
