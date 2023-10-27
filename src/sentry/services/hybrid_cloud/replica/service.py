import abc

from sentry.hybridcloud.rpc_services.control_organization_provisioning import (
    RpcOrganizationSlugReservation,
)
from sentry.services.hybrid_cloud.auth import (
    RpcApiKey,
    RpcApiToken,
    RpcAuthIdentity,
    RpcAuthProvider,
)
from sentry.services.hybrid_cloud.notifications import RpcExternalActor
from sentry.services.hybrid_cloud.organization import RpcOrganizationMemberTeam, RpcTeam
from sentry.services.hybrid_cloud.orgauthtoken.model import RpcOrgAuthToken
from sentry.services.hybrid_cloud.region import ByRegionName
from sentry.services.hybrid_cloud.rpc import RpcService, regional_rpc_method, rpc_method
from sentry.silo import SiloMode


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

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from .impl import DatabaseBackedControlReplicaService

        return DatabaseBackedControlReplicaService()


class RegionReplicaService(RpcService):
    key = "region_replica"
    local_mode = SiloMode.REGION

    @regional_rpc_method(resolve=ByRegionName())
    @abc.abstractmethod
    def upsert_replicated_auth_provider(
        self, *, auth_provider: RpcAuthProvider, region_name: str
    ) -> None:
        pass

    @regional_rpc_method(resolve=ByRegionName())
    @abc.abstractmethod
    def upsert_replicated_auth_identity(
        self, *, auth_identity: RpcAuthIdentity, region_name: str
    ) -> None:
        pass

    @regional_rpc_method(resolve=ByRegionName())
    @abc.abstractmethod
    def upsert_replicated_api_key(self, *, api_key: RpcApiKey, region_name: str) -> None:
        pass

    @regional_rpc_method(resolve=ByRegionName())
    @abc.abstractmethod
    def upsert_replicated_api_token(self, *, api_token: RpcApiToken, region_name: str) -> None:
        pass

    @regional_rpc_method(resolve=ByRegionName())
    @abc.abstractmethod
    def upsert_replicated_org_auth_token(self, *, token: RpcOrgAuthToken, region_name: str) -> None:
        pass

    @regional_rpc_method(resolve=ByRegionName())
    @abc.abstractmethod
    def upsert_replicated_org_slug_reservation(
        self, *, slug_reservation: RpcOrganizationSlugReservation, region_name: str
    ) -> None:
        pass

    @regional_rpc_method(resolve=ByRegionName())
    @abc.abstractmethod
    def delete_replicated_org_slug_reservation(
        self, *, organization_slug_reservation_id: int, region_name: str
    ) -> None:
        pass

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from .impl import DatabaseBackedRegionReplicaService

        return DatabaseBackedRegionReplicaService()


region_replica_service = RegionReplicaService.create_delegation()
control_replica_service = ControlReplicaService.create_delegation()
