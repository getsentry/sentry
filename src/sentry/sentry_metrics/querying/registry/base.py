from abc import ABC, abstractmethod
from typing import Dict, Optional, Set, Union

from snuba_sdk import Formula, Timeseries

from sentry.snuba.dataset import EntityKey


class RegistryEntry(ABC):
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)

        return cls._instance

    def is_supported(self, entity: EntityKey) -> bool:
        return entity in self.for_entities

    @property
    @abstractmethod
    def from_op(self) -> str:
        raise NotImplementedError

    @property
    def for_entities(self) -> Set[EntityKey]:
        return set()

    @abstractmethod
    def get(self, prev_timeseries: Timeseries) -> Union[Formula, Timeseries]:
        raise NotImplementedError


class Registry:
    def __init__(self):
        self._registered_entries: Dict[str, RegistryEntry] = {}

    def register(self, entry: RegistryEntry):
        self._registered_entries[entry.from_op] = entry

    def get(self, from_op: str) -> Optional[RegistryEntry]:
        return self._registered_entries.get(from_op)
