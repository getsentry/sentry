from typing import Optional, Set, Union

from snuba_sdk import Formula, Timeseries

from sentry.sentry_metrics.querying.registry.base import (
    ALL_GENERIC_METRICS,
    Registry,
    RegistryEntry,
)
from sentry.snuba.dataset import EntityKey


class Alias(RegistryEntry):
    def __init__(
        self, from_op: str, to_op: str, supported_entities: Optional[Set[EntityKey]] = None
    ):
        self._from_op = from_op
        self._to_op = to_op
        self._supported_entities = supported_entities or set()

    def from_op(self) -> str:
        return self._from_op

    def supported_entities(self) -> Set[EntityKey]:
        return self._supported_entities

    def get(self, prev_timeseries: Timeseries) -> Union[Formula, Timeseries]:
        return prev_timeseries.set_aggregate(self._to_op)


ALIASES_REGISTRY = Registry()
ALIASES_REGISTRY.register(
    Alias(from_op="count_unique", to_op="uniq", supported_entities=ALL_GENERIC_METRICS)
)
