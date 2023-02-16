from typing import Any, MutableMapping

from sentry.models import ControlTombstone, RegionTombstone
from sentry.services.hybrid_cloud.tombstone import RpcTombstone, TombstoneService
from sentry.silo import SiloMode


class RegionTombstoneService(TombstoneService):
    def record_remote_tombstone(self, tombstone: RpcTombstone) -> None:
        RegionTombstone.record_delete(tombstone.table_name, tombstone.identifier)

    def close(self) -> None:
        pass


class ControlTombstoneService(TombstoneService):
    def record_remote_tombstone(self, tombstone: RpcTombstone) -> None:
        ControlTombstone.record_delete(tombstone.table_name, tombstone.identifier)

    def close(self) -> None:
        pass


class MonolithTombstoneService(TombstoneService):
    # In the future, no single deployment can be a source of truth about the location of all models due to
    # deployment drift, however the current deployment (for which this is a bridging implementation), can.
    # We use silo limits information to infer the correct destination.
    by_table_name: MutableMapping[str, Any]

    def __init__(self) -> None:
        super().__init__()
        self.by_table_name = {}

    def _get_model(self, table_name: str) -> Any:
        from django.apps import apps

        if model := self.by_table_name.get(table_name):
            return model

        for app, app_models in apps.all_models.items():
            for model in app_models.values():
                if model._meta.db_table == table_name:
                    if hasattr(model._meta, "silo_limit"):
                        self.by_table_name[table_name] = model
                        return model
        raise ValueError(f"Could not find model by table name {table_name}")

    def record_remote_tombstone(self, tombstone: RpcTombstone) -> None:
        model = self._get_model(tombstone.table_name)
        if SiloMode.CONTROL in model._meta.silo_limit.modes:
            RegionTombstone.record_delete(tombstone.table_name, tombstone.identifier)
        else:
            ControlTombstone.record_delete(tombstone.table_name, tombstone.identifier)

    def close(self) -> None:
        pass
