from abc import ABC, abstractmethod
from typing import Dict, Optional, Set, Union

from snuba_sdk import Formula, Timeseries

from sentry.snuba.dataset import EntityKey

ALL_GENERIC_METRICS = {
    EntityKey.GenericMetricsCounters,
    EntityKey.GenericMetricsDistributions,
    EntityKey.GenericMetricsSets,
    EntityKey.GenericMetricsGauges,
}


class RegistryEntry(ABC):
    def is_supported(self, entity: EntityKey) -> bool:
        return entity in self.supported_entities()

    @abstractmethod
    def from_op(self) -> str:
        raise NotImplementedError

    def supported_entities(self) -> Set[EntityKey]:
        return set()

    @abstractmethod
    def get(self, prev_timeseries: Timeseries) -> Union[Formula, Timeseries]:
        raise NotImplementedError


class Registry:
    def __init__(self):
        self._registered_entries: Dict[str, RegistryEntry] = {}

    def register(self, entry: RegistryEntry):
        self._registered_entries[entry.from_op()] = entry

    def get(self, from_op: str) -> Optional[RegistryEntry]:
        return self._registered_entries.get(from_op)


class CompositeRegistry(Registry):
    def __init__(self, registry_1: Registry, registry_2: Registry):
        super().__init__()
        self._registry_1 = registry_1
        self._registry_2 = registry_2

    @classmethod
    def combine(cls, registry_1: "Registry", registry_2: "Registry") -> "CompositeRegistry":
        return CompositeRegistry(registry_1, registry_2)

    def register(self, entry: RegistryEntry):
        raise RuntimeError("Can't register on a composite registry")

    def get(self, from_op: str) -> Optional[RegistryEntry]:
        first = self._registry_1.get(from_op)
        if first is not None:
            return first

        second = self._registry_2.get(from_op)
        return second
