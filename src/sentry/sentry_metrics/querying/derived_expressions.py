from snuba_sdk import ArithmeticOperator, Column, Condition, Formula, Op, Timeseries

from sentry.sentry_metrics.querying.registry import RegistryEntry
from sentry.sentry_metrics.querying.types import (
    Argument,
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
                    filters=[Condition(Column("failure"), Op.EQ, "true")],
                ),
                Timeseries(
                    aggregate="count",
                    metric=Argument(0, MetricArg()),
                ),
            ],
        )
