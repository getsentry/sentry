# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.
from abc import abstractmethod

from sentry.hybridcloud.rpc.resolvers import ByCellName
from sentry.hybridcloud.rpc.service import RpcService, cell_rpc_method, rpc_method
from sentry.hybridcloud.services.tombstone import RpcTombstone
from sentry.silo.base import SiloMode


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


class CellTombstoneService(RpcService):
    key = "region_tombstone"
    local_mode = SiloMode.CELL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from .impl import DatabaseBackedCellTombstoneService

        return DatabaseBackedCellTombstoneService()

    @cell_rpc_method(resolve=ByCellName())
    @abstractmethod
    def record_remote_tombstone(
        self,
        *,
        cell_name: str,
        tombstone: RpcTombstone,
    ) -> None:
        pass


cell_tombstone_service = CellTombstoneService.create_delegation()
control_tombstone_service = ControlTombstoneService.create_delegation()
