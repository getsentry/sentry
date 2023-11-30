from typing import Set, Union

from snuba_sdk import ArithmeticOperator, Formula, Timeseries

from sentry.sentry_metrics.querying.registry.base import Registry, RegistryEntry
from sentry.snuba.dataset import EntityKey


class AvgGauge(RegistryEntry):
    def from_op(self) -> str:
        return "avg"

    def supported_entities(self) -> Set[EntityKey]:
        return {EntityKey.GenericMetricsGauges}

    def get(self, prev_timeseries: Timeseries) -> Union[Formula, Timeseries]:
        return Formula(
            operator=ArithmeticOperator.DIVIDE,
            parameters=[
                prev_timeseries.set_aggregate("sum"),
                prev_timeseries.set_aggregate("count"),
            ],
        )


DEFAULT_REGISTRY = Registry()
DEFAULT_REGISTRY.register(AvgGauge())
