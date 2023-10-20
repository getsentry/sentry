# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.
from abc import abstractmethod

from sentry.services.hybrid_cloud.region import ByRegionName
from sentry.services.hybrid_cloud.rpc import RpcService, regional_rpc_method, rpc_method
from sentry.services.hybrid_cloud.tombstone import RpcTombstone
from sentry.silo import SiloMode


# the tombstone service itself is unaware of model mapping, that is the responsibility of the caller and the outbox
# logic.  Basically, if you record a remote tombstone, you are implying the destination table_name exists, remotely.
# Implementors should, thus, _not_ constraint these entries and gracefully handle version drift cases when the "mapping"
# of who owns what models changes independent of the rollout of logic.
class ControlTombstoneService(RpcService):
    key = "control_tombstone"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from .impl import DatabaseBackedControlTombstoneService

        return DatabaseBackedControlTombstoneService()

    @rpc_method
    @abstractmethod
    def record_remote_tombstone(self, *, tombstone: RpcTombstone) -> None:
        pass


class RegionTombstoneService(RpcService):
    key = "region_tombstone"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from .impl import DatabaseBackedRegionTombstoneService

        return DatabaseBackedRegionTombstoneService()

    @regional_rpc_method(resolve=ByRegionName())
    @abstractmethod
    def record_remote_tombstone(self, *, region_name: str, tombstone: RpcTombstone) -> None:
        pass


region_tombstone_service = RegionTombstoneService.create_delegation()
control_tombstone_service = ControlTombstoneService.create_delegation()
