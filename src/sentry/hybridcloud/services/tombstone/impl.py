from sentry.hybridcloud.services.tombstone import (
    CellTombstoneService,
    ControlTombstoneService,
    RpcTombstone,
)
from sentry.models.tombstone import ControlTombstone, RegionTombstone


class DatabaseBackedCellTombstoneService(CellTombstoneService):
    def record_remote_tombstone(
        self,
        *,
        cell_name: str | None = None,  # TODO(cells): make required when all callers are updated
        region_name: str | None = None,  # TODO(cells): remove when all callers are updated
        tombstone: RpcTombstone,
    ) -> None:
        RegionTombstone.record_delete(tombstone.table_name, tombstone.identifier)


class DatabaseBackedControlTombstoneService(ControlTombstoneService):
    def record_remote_tombstone(self, *, tombstone: RpcTombstone) -> None:
        ControlTombstone.record_delete(tombstone.table_name, tombstone.identifier)
