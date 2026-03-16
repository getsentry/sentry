import abc

from sentry.auth.services.auth import RpcApiKey, RpcApiToken, RpcAuthIdentity, RpcAuthProvider
from sentry.auth.services.orgauthtoken.model import RpcOrgAuthToken
from sentry.hybridcloud.rpc.resolvers import ByCellName
from sentry.hybridcloud.rpc.service import RpcService, cell_rpc_method, rpc_method
from sentry.hybridcloud.services.control_organization_provisioning import (
    RpcOrganizationSlugReservation,
)
from sentry.hybridcloud.services.project_key_mapping import RpcProjectKeyMapping
from sentry.notifications.services import RpcExternalActor
from sentry.organizations.services.organization import RpcOrganizationMemberTeam, RpcTeam
from sentry.silo.base import SiloMode


class ControlReplicaService(RpcService):
    key = "control_replica"
    local_mode = SiloMode.CONTROL

    @rpc_method
    @abc.abstractmethod
    def upsert_replicated_team(self, *, team: RpcTeam) -> None:
        pass

    @rpc_method
    @abc.abstractmethod
    def upsert_replicated_organization_member_team(self, *, omt: RpcOrganizationMemberTeam) -> None:
        pass

    @rpc_method
    @abc.abstractmethod
    def remove_replicated_organization_member_team(
        self, *, organization_id: int, organization_member_team_id: int
    ) -> None:
        pass

    @rpc_method
    @abc.abstractmethod
    def upsert_external_actor_replica(self, *, external_actor: RpcExternalActor) -> None:
        pass

    @rpc_method
    @abc.abstractmethod
    def upsert_project_key_mapping(self, *, project_key: RpcProjectKeyMapping) -> bool:
        """
        Returns True if the mapping was successfully created or updated, False if there was a
        conflict (e.g. a duplicate public_key).
        """
        pass

    @rpc_method
    @abc.abstractmethod
    def delete_project_key_mapping(self, *, project_key_id: int, cell_name: str) -> None:
        pass

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from .impl import DatabaseBackedControlReplicaService

        return DatabaseBackedControlReplicaService()


class RegionReplicaService(RpcService):
    key = "region_replica"
    local_mode = SiloMode.CELL

    @cell_rpc_method(resolve=ByCellName())
    @abc.abstractmethod
    def upsert_replicated_auth_provider(
        self,
        *,
        auth_provider: RpcAuthProvider,
        cell_name: str | None = None,
        region_name: str | None = None,
    ) -> None:
        pass

    @cell_rpc_method(resolve=ByCellName())
    @abc.abstractmethod
    def upsert_replicated_auth_identity(
        self,
        *,
        auth_identity: RpcAuthIdentity,
        cell_name: str | None = None,
        region_name: str | None = None,
    ) -> None:
        pass

    @cell_rpc_method(resolve=ByCellName())
    @abc.abstractmethod
    def upsert_replicated_api_key(
        self, *, api_key: RpcApiKey, cell_name: str | None = None, region_name: str | None = None
    ) -> None:
        pass

    @cell_rpc_method(resolve=ByCellName())
    @abc.abstractmethod
    def upsert_replicated_api_token(
        self,
        *,
        api_token: RpcApiToken,
        cell_name: str | None = None,
        region_name: str | None = None,
    ) -> None:
        pass

    @cell_rpc_method(resolve=ByCellName())
    @abc.abstractmethod
    def delete_replicated_api_token(
        self, *, apitoken_id: int, cell_name: str | None = None, region_name: str | None = None
    ) -> None:
        pass

    @cell_rpc_method(resolve=ByCellName())
    @abc.abstractmethod
    def upsert_replicated_org_auth_token(
        self,
        *,
        token: RpcOrgAuthToken,
        cell_name: str | None = None,
        region_name: str | None = None,
    ) -> None:
        pass

    @cell_rpc_method(resolve=ByCellName())
    @abc.abstractmethod
    def upsert_replicated_org_slug_reservation(
        self,
        *,
        slug_reservation: RpcOrganizationSlugReservation,
        cell_name: str | None = None,
        region_name: str | None = None,
    ) -> None:
        pass

    @cell_rpc_method(resolve=ByCellName())
    @abc.abstractmethod
    def delete_replicated_org_slug_reservation(
        self,
        *,
        organization_slug_reservation_id: int,
        cell_name: str | None = None,
        region_name: str | None = None,
    ) -> None:
        pass

    @cell_rpc_method(resolve=ByCellName())
    @abc.abstractmethod
    def delete_replicated_auth_provider(
        self, *, auth_provider_id: int, cell_name: str | None = None, region_name: str | None = None
    ) -> None:
        pass

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from .impl import DatabaseBackedRegionReplicaService

        return DatabaseBackedRegionReplicaService()


region_replica_service = RegionReplicaService.create_delegation()
control_replica_service = ControlReplicaService.create_delegation()
