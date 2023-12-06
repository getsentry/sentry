from sentry.models.tombstone import ControlTombstone, RegionTombstone
from sentry.services.hybrid_cloud.tombstone import (
    ControlTombstoneService,
    RegionTombstoneService,
    RpcTombstone,
)


class DatabaseBackedRegionTombstoneService(RegionTombstoneService):
    def record_remote_tombstone(self, *, region_name: str, tombstone: RpcTombstone) -> None:
        RegionTombstone.record_delete(tombstone.table_name, tombstone.identifier)


class DatabaseBackedControlTombstoneService(ControlTombstoneService):
    def record_remote_tombstone(self, *, tombstone: RpcTombstone) -> None:
        ControlTombstone.record_delete(tombstone.table_name, tombstone.identifier)
