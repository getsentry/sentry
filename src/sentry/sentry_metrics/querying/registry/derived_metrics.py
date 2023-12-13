from typing import Set, Union

from snuba_sdk import ArithmeticOperator, Formula, Timeseries

from sentry.sentry_metrics.querying.registry.base import Registry, RegistryEntry
from sentry.snuba.dataset import EntityKey


class AvgGauge(RegistryEntry):
    def from_op(self) -> str:
        return "avg"

    def get(self, prev_timeseries: Timeseries) -> Union[Formula, Timeseries]:
        return Formula(
            operator=ArithmeticOperator.DIVIDE,
            parameters=[
                prev_timeseries.set_aggregate("sum"),
                prev_timeseries.set_aggregate("count"),
            ],
        )

class Type(Enum):
    STRING
    NUMBER
    METRIC


class FailureRate(RegistryEntry):

    def op() -> str:
        return "failure_rate"

    def expression(self) -> Union[Formula, Timeseries]:
        return Formula(
            operator=ArithmeticOperator.DIVIDE,
            parameters=[
                Timeseries(
                    aggregate="count",
                    params=[Placeholder(0, type=MRI)] + ["failure": "true"]
                ),
                Timeseries(
                    aggregate="count",
                    params=Placeholder(0, type=MRI)
                ),
            ],
        )


DERIVED_METRICS_REGISTRY = Registry()
DERIVED_METRICS_REGISTRY.register(AvgGauge())
