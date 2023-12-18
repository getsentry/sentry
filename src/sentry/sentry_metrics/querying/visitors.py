from abc import ABC
from typing import Any, Generic, Optional, Sequence, TypeVar, Union

from snuba_sdk import (
    AliasedExpression,
    BooleanCondition,
    BooleanOp,
    Column,
    Condition,
    Formula,
    Op,
    Timeseries,
)
from snuba_sdk.conditions import ConditionGroup

from sentry.models.environment import Environment
from sentry.sentry_metrics.querying.errors import InvalidMetricsQueryError
from sentry.sentry_metrics.querying.registry import ExpressionRegistry
from sentry.sentry_metrics.querying.types import (
    Argument,
    InheritFilters,
    InheritGroupby,
    QueryExpression,
)

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

    def _visit_timeseries(self, timeseries: Timeseries) -> TVisited:
        raise NotImplementedError


class ExpansionVisitor(QueryExpressionVisitor[QueryExpression]):
    """
    Visitor that recursively expands expressions that are defined in the `ExpressionRegistry`.
    """

    def __init__(self, registry: ExpressionRegistry):
        self._registry = registry

    def _visit_timeseries(self, timeseries: Timeseries) -> QueryExpression:
        registry_entry = self._registry.try_resolve(timeseries.aggregate)
        if registry_entry is None:
            return timeseries

        # We always map the metric as the param at index 0.
        timeseries_params = [timeseries.metric] + (timeseries.aggregate_params or [])

        # We compute the first expression.
        expression = registry_entry.expression()
        # We run the replacement visitor to replace placeholders.
        expression = ReplacementVisitor(
            arguments=timeseries_params, filters=timeseries.filters, groupby=timeseries.groupby
        ).visit(expression)

        # We recursively run substitutions in the newly created tree. We need to be careful about possible infinite
        # recursion.
        return self.visit(expression)


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


class ReplacementVisitor(QueryExpressionVisitor[QueryExpression]):
    """
    Visitor that recursively replaces `Placeholder` elements with the correct values.
    """

    def __init__(
        self,
        arguments: Sequence[Any],
        filters: Optional[ConditionGroup],
        groupby: Optional[Sequence[Union[Column, AliasedExpression]]],
    ):
        self._arguments = arguments
        self._filters = filters
        self._groupby = groupby

    def _visit_timeseries(self, timeseries: Timeseries) -> QueryExpression:
        if isinstance(timeseries.metric, Argument):
            timeseries = timeseries.set_metric(self._visit_argument(timeseries.metric))

        replaced_aggregate_params = []
        for aggregate_param in timeseries.aggregate_params or ():
            if isinstance(aggregate_param, Argument):
                replaced_aggregate_params.append(self._visit_argument(aggregate_param))
            else:
                replaced_aggregate_params.append(aggregate_param)
        timeseries = timeseries.set_aggregate(
            timeseries.aggregate, replaced_aggregate_params or None
        )

        replaced_filters = []
        for filter in timeseries.filters or ():
            if isinstance(filter, InheritFilters):
                replaced_filters += self._filters or []
            else:
                replaced_filters.append(filter)
        timeseries = timeseries.set_filters(replaced_filters or None)

        replaced_groupby = []
        for groupby in timeseries.groupby:
            if isinstance(groupby, InheritGroupby):
                replaced_groupby += self._groupby or []
            else:
                replaced_groupby.append(groupby)
        timeseries = timeseries.set_groupby(replaced_groupby or None)

        return timeseries

    def _visit_argument(self, argument: Argument) -> Any:
        arg_value = self._arguments[argument.position]
        if not argument.validate(arg_value):
            raise InvalidMetricsQueryError(f"Argument at position {argument.position} not valid")

        return arg_value
