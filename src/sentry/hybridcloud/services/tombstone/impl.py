from sentry.hybridcloud.services.tombstone import (
    CellTombstoneService,
    ControlTombstoneService,
    RpcTombstone,
)
from sentry.models.tombstone import ControlTombstone, RegionTombstone


class DatabaseBackedCellTombstoneService(CellTombstoneService):
    def record_remote_tombstone(self, *, region_name: str, tombstone: RpcTombstone) -> None:
        RegionTombstone.record_delete(tombstone.table_name, tombstone.identifier)


class DatabaseBackedControlTombstoneService(ControlTombstoneService):
    def record_remote_tombstone(self, *, tombstone: RpcTombstone) -> None:
        ControlTombstone.record_delete(tombstone.table_name, tombstone.identifier)
