from sentry.hybridcloud.services.tombstone import (
    CellTombstoneService,
    ControlTombstoneService,
    RpcTombstone,
)
from sentry.models.tombstone import CellTombstone, ControlTombstone


class DatabaseBackedCellTombstoneService(CellTombstoneService):
    def record_remote_tombstone(
        self,
        *,
        cell_name: str,
        tombstone: RpcTombstone,
    ) -> None:
        CellTombstone.record_delete(tombstone.table_name, tombstone.identifier)


class DatabaseBackedControlTombstoneService(ControlTombstoneService):
    def record_remote_tombstone(self, *, tombstone: RpcTombstone) -> None:
        ControlTombstone.record_delete(tombstone.table_name, tombstone.identifier)
