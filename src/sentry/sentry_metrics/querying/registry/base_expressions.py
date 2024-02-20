from snuba_sdk import ArithmeticOperator, Column, Condition, Formula, Op, Timeseries

from sentry.sentry_metrics.querying.registry.base import (
    Argument,
    MetricArg,
    NumberArg,
    RegistryEntry,
    TimeseriesArg,
)
from sentry.sentry_metrics.querying.types import QueryExpression


class Rate(RegistryEntry):
    # rate(interval)(aggregate(mri))

    def op(self) -> str:
        return "rate"

    def expression(self) -> QueryExpression:
        return Formula(
            function_name=ArithmeticOperator.DIVIDE.value,
            parameters=[
                Argument(1, TimeseriesArg()),
                Argument(0, NumberArg()),
            ],
        )


class FailureRate(RegistryEntry):
    # failure_rate(mri)

    def op(self) -> str:
        return "failure_rate"

    def expression(self) -> QueryExpression:
        return Formula(
            function_name=ArithmeticOperator.DIVIDE.value,
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
