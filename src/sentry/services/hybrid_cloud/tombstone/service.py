# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod

from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation
from sentry.services.hybrid_cloud.tombstone import RpcTombstone
from sentry.silo import SiloMode


# the tombstone service itself is unaware of model mapping, that is the responsibility of the caller and the outbox
# logic.  Basically, if you record a remote tombstone, you are implying the destination table_name exists, remotely.
# Implementors should, thus, _not_ constraint these entries and gracefully handle version drift cases when the "mapping"
# of who owns what models changes independent of the rollout of logic.
class TombstoneService(InterfaceWithLifecycle):
    @abstractmethod
    def record_remote_tombstone(self, tombstone: RpcTombstone) -> None:
        pass


def control_impl() -> TombstoneService:
    from sentry.services.hybrid_cloud.tombstone.impl import ControlTombstoneService

    return ControlTombstoneService()


def region_impl() -> TombstoneService:
    from sentry.services.hybrid_cloud.tombstone.impl import RegionTombstoneService

    return RegionTombstoneService()


def monolith_impl() -> TombstoneService:
    from sentry.services.hybrid_cloud.tombstone.impl import MonolithTombstoneService

    return MonolithTombstoneService()


tombstone_service: TombstoneService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: monolith_impl,
        SiloMode.REGION: region_impl,
        SiloMode.CONTROL: control_impl,
    }
)
