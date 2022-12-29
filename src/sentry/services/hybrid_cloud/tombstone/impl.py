from sentry.models import ControlTombstone, RegionTombstone
from sentry.services.hybrid_cloud.tombstone import ApiTombstone, TombstoneService
from sentry.silo import SiloMode


class RegionTombstoneService(TombstoneService):
    def record_remote_tombstone(self, tombstone: ApiTombstone) -> None:
        RegionTombstone.record_delete(tombstone.table_name, tombstone.identifier)

    def close(self) -> None:
        pass


class ControlTombstoneService(TombstoneService):
    def record_remote_tombstone(self, tombstone: ApiTombstone) -> None:
        ControlTombstone.record_delete(tombstone.table_name, tombstone.identifier)

    def close(self) -> None:
        pass


class MonolithTombstoneService(TombstoneService):
    # In the future, no single deployment can be a source of truth about the location of all models due to
    # deployment drift, however the current deployment (for which this is a bridging implementation), can.
    # We use silo limits information to infer the correct destination.

    def record_remote_tombstone(self, tombstone: ApiTombstone) -> None:
        from django.apps import apps

        for app, app_models in apps.all_models.items():
            for model in app_models.values():
                if limits := getattr(getattr(model, "_meta"), "silo_limits", None):
                    if SiloMode.CONTROL in limits.silos:
                        RegionTombstone.record_delete(tombstone.table_name, tombstone.identifier)
                    else:
                        ControlTombstone.record_delete(tombstone.table_name, tombstone.identifier)

    def close(self) -> None:
        pass
