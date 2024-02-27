from snuba_sdk import ArithmeticOperator, Formula

from sentry.sentry_metrics.querying.registry.base import (
    Argument,
    ExpressionRegistry,
    InheritFilters,
    InheritGroupBys,
    NumberArg,
    QueryExpressionArg,
    RegistryEntry,
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
                Argument(1, QueryExpressionArg()),
                Argument(0, NumberArg()),
            ],
            filters=[InheritFilters()],
            groupby=[InheritGroupBys()],
        )


DDM_REGISTRY = ExpressionRegistry()
DDM_REGISTRY.register(Rate())
