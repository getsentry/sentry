from abc import ABC, abstractmethod
from typing import Generic, Optional, Sequence, TypeVar

from snuba_sdk import BooleanCondition, BooleanOp, Column, Condition, Formula, Op, Timeseries
from snuba_sdk.conditions import ConditionGroup

from sentry.models.environment import Environment
from sentry.sentry_metrics.querying.errors import InvalidMetricsQueryError
from sentry.sentry_metrics.querying.registry import ExpressionRegistry
from sentry.sentry_metrics.querying.types import QueryExpression

TVisited = TypeVar("TVisited")


class QueryExpressionVisitor(ABC, Generic[TVisited]):
    """
    Abstract visitor that defines a visiting behavior of a `QueryExpression`.
    """

    def visit(self, query: QueryExpression) -> TVisited:
        if isinstance(query, Formula):
            return self._visit_formula(query)
        elif isinstance(query, Timeseries):
            return self._visit_timeseries(query)

        raise AssertionError(f"Unhandled expression {query}")

    def _visit_formula(self, formula: Formula) -> TVisited:
        # The default implementation just mutates the parameters of the `Formula`.
        parameters = []
        for parameter in formula.parameters:
            parameters.append(self.visit(parameter))

        return formula.set_parameters(parameters)

    @abstractmethod
    def _visit_timeseries(self, timeseries: Timeseries) -> TVisited:
        raise NotImplementedError


class ExpansionVisitor(QueryExpressionVisitor[QueryExpression]):
    """
    Visitor that recursively expands expressions that are defined in the `ExpressionRegistry`.
    """

    def __init__(self, registry: ExpressionRegistry):
        self._registry = registry

    def _visit_timeseries(self, timeseries: Timeseries) -> QueryExpression:
        # In case we don't have an MRI set, we don't want to even try to resolve the
        if not timeseries.metric.mri:
            return timeseries

        expanded_expression = self._registry.try_resolve(timeseries.metric.mri)
        if expanded_expression is None:
            return timeseries

        # We recursively run substitutions in the newly created tree. We need to be careful about possible infinite
        # recursion.
        return self.visit(expanded_expression)


class EnvironmentsInjectionVisitor(QueryExpressionVisitor[QueryExpression]):
    """
    Visitor that recursively injects the environments filter into all `Timeseries`.
    """

    def __init__(self, environments: Sequence[Environment]):
        self._environment_names = [environment.name for environment in environments]

    def _visit_timeseries(self, timeseries: Timeseries) -> QueryExpression:
        current_filters = timeseries.filters if timeseries.filters else []
        if self._environment_names:
            current_filters.extend(
                [Condition(Column("environment"), Op.IN, self._environment_names)]
            )

        return timeseries.set_filters(current_filters)


class ValidationVisitor(QueryExpressionVisitor[QueryExpression]):
    """
    Visitor that recursively validates the query expression.
    """

    def _visit_timeseries(self, timeseries: Timeseries) -> QueryExpression:
        self._validate_filters(timeseries.filters)
        return timeseries

    def _validate_filters(self, filters: Optional[ConditionGroup]):
        for f in filters or ():
            if isinstance(f, BooleanCondition):
                if f.op == BooleanOp.OR:
                    raise InvalidMetricsQueryError("The OR operator is not supported")

                self._validate_filters(f.conditions)
