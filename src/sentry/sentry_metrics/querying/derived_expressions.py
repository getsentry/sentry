from snuba_sdk import ArithmeticOperator, Column, Condition, Formula, Op, Timeseries

from sentry.sentry_metrics.querying.registry import RegistryEntry
from sentry.sentry_metrics.querying.types import (
    Argument,
    InheritFilters,
    InheritGroupby,
    MetricArg,
    QueryExpression,
)


class FailureRate(RegistryEntry):
    def op(self) -> str:
        return "failure_rate"

    def expression(self) -> QueryExpression:
        return Formula(
            operator=ArithmeticOperator.DIVIDE,
            parameters=[
                Timeseries(
                    aggregate="count",
                    metric=Argument(0, MetricArg()),
                    filters=[InheritFilters(), Condition(Column("failure"), Op.EQ, "true")],
                    groupby=[InheritGroupby()],
                ),
                Timeseries(
                    aggregate="count",
                    metric=Argument(0, MetricArg()),
                    filters=[InheritFilters()],
                    groupby=[InheritGroupby()],
                ),
            ],
        )
