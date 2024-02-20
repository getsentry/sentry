from collections.abc import Sequence
from typing import Any

from snuba_sdk import AliasedExpression, Column, Condition, Formula, Op, Timeseries
from snuba_sdk.conditions import ConditionGroup

from sentry.models.environment import Environment
from sentry.sentry_metrics.querying.errors import InvalidMetricsQueryError
from sentry.sentry_metrics.querying.registry.base import Argument, ExpressionRegistry
from sentry.sentry_metrics.querying.types import QueryExpression
from sentry.sentry_metrics.querying.visitors.base import (
    QueryConditionVisitor,
    QueryExpressionVisitor,
)
from sentry.snuba.metrics import parse_mri


class EnvironmentsInjectionVisitor(QueryExpressionVisitor[QueryExpression]):
    """
    Visitor that recursively injects the environments filter into all `Timeseries`.
    """

    def __init__(self, environments: Sequence[Environment]):
        self._environment_names = [environment.name for environment in environments]

    def _visit_timeseries(self, timeseries: Timeseries) -> QueryExpression:
        if self._environment_names:
            current_filters = timeseries.filters if timeseries.filters else []
            current_filters.extend(
                [Condition(Column("environment"), Op.IN, self._environment_names)]
            )

            return timeseries.set_filters(current_filters)

        return timeseries


class TimeseriesConditionInjectionVisitor(QueryExpressionVisitor[QueryExpression]):
    """
    Visitor that recursively injects a `ConditionGroup` into all `Timeseries`.
    """

    def __init__(self, condition_group: ConditionGroup):
        self._condition_group = condition_group

    def _visit_timeseries(self, timeseries: Timeseries) -> QueryExpression:
        if self._condition_group:
            current_filters = timeseries.filters if timeseries.filters else []
            current_filters.extend(self._condition_group)

            return timeseries.set_filters(current_filters)

        return timeseries


class QueryValidationVisitor(QueryExpressionVisitor[QueryExpression]):
    """
    Visitor that recursively validates the `QueryExpression`.
    """

    def _visit_timeseries(self, timeseries: Timeseries) -> QueryExpression:
        # This visitor has been kept in case we need future validations.
        return timeseries


class QueryValidationV2Visitor(QueryExpressionVisitor[QueryExpression]):
    """
    Visitor that recursively validates the `QueryExpression` of the new endpoint.
    """

    def __init__(self):
        self._query_namespace = None
        self._query_entity = None
        self._query_group_bys = None
        self._query_group_bys_stack: list[list[str]] = []

    def _visit_formula(self, formula: Formula) -> QueryExpression:
        # We already add the flattened group bys in the stack, to avoid re-computation for every leaf.
        self._query_group_bys_stack.append(self._flatten_group_bys(formula.groupby))

        for parameter in formula.parameters:
            self.visit(parameter)

        self._query_group_bys_stack.pop()

        return formula

    def _visit_timeseries(self, timeseries: Timeseries) -> QueryExpression:
        if timeseries.metric.mri is None:
            raise InvalidMetricsQueryError("You must supply a metric MRI when querying a metric")

        parsed_mri = parse_mri(timeseries.metric.mri)
        if parsed_mri is None:
            raise InvalidMetricsQueryError(
                f"The metric MRI {timeseries.metric.mri} couldn't be parsed"
            )

        namespace = parsed_mri.namespace
        entity = parsed_mri.entity

        if self._query_namespace is None:
            self._query_namespace = namespace
        elif self._query_namespace != namespace:
            raise InvalidMetricsQueryError(
                "Querying metrics belonging to different namespaces is not allowed"
            )

        if self._query_entity is None:
            self._query_entity = parsed_mri.entity
        elif self._query_entity != entity:
            raise InvalidMetricsQueryError(
                "Querying metrics with different metrics type is not currently supported"
            )

        self._validate_accumulated_group_bys(timeseries)

        return timeseries

    def _validate_accumulated_group_bys(self, timeseries: Timeseries):
        """
        Validates that the group bys on a given `Timeseries` are equal to the ones previously encountered (if any).

        To obtain the group bys of the `Timeseries` all the group bys of the upstream `Formulas` are merged and ordered
        together with the ones of the `Timeseries`.
        """
        group_bys = []

        # We first add all the group bys that we got at each stack frame.
        for upstream_group_bys in self._query_group_bys_stack:
            group_bys += upstream_group_bys

        # We then add all the group bys of the timeseries itself.
        group_bys += self._flatten_group_bys(timeseries.groupby)

        # We deduplicate and sort all the merged group bys in order to have a consistent view of the used group bys.
        sorted_group_bys = sorted(set(group_bys))
        if self._query_group_bys is None:
            self._query_group_bys = sorted_group_bys
        elif self._query_group_bys != sorted_group_bys:
            raise InvalidMetricsQueryError(
                "Querying metrics with different group bys is not allowed"
            )

    def _flatten_group_bys(self, group_bys: list[Column | AliasedExpression] | None) -> list[str]:
        """
        Flattens a list of group bys by converting it to a flat list of strings, representing the names of the column
        that the query is grouping by.
        """

        def _column_name(group_by: Column | AliasedExpression) -> str:
            if isinstance(group_by, Column):
                return group_by.name
            elif isinstance(group_by, AliasedExpression):
                return group_by.exp.name

            return ""

        if group_bys is None:
            return []

        return list(map(_column_name, group_bys))


class QueryConditionsCompositeVisitor(QueryExpressionVisitor[QueryExpression]):
    """
    Visitor that runs a series of `QueryConditionVisitor`(s) on each filters of elements of a `QueryExpression`.
    """

    def __init__(self, *visitors: QueryConditionVisitor):
        self._visitors = list(visitors)

    def _visit_formula(self, formula: Formula) -> QueryExpression:
        if formula.filters:
            formula = formula.set_filters(self._apply_visitors_on_condition_group(formula.filters))

        return super()._visit_formula(formula)

    def _visit_timeseries(self, timeseries: Timeseries) -> QueryExpression:
        if not timeseries.filters:
            return timeseries

        return timeseries.set_filters(self._apply_visitors_on_condition_group(timeseries.filters))

    def _apply_visitors_on_condition_group(
        self, condition_group: ConditionGroup | None
    ) -> ConditionGroup | None:
        if not condition_group:
            return condition_group

        visited_condition_group = condition_group
        for visitor in self._visitors:
            visited_condition_group = visitor.visit_group(visited_condition_group)

        return visited_condition_group


class QueriedMetricsVisitor(QueryExpressionVisitor[set[str]]):
    """
    Visitor that recursively computes all the metrics MRI of the `QueryExpression`.
    """

    def _visit_formula(self, formula: Formula) -> set[str]:
        metrics: set[str] = set()

        for parameter in formula.parameters:
            metrics.union(self.visit(parameter))

        return metrics

    def _visit_timeseries(self, timeseries: Timeseries) -> set[str]:
        if timeseries.metric.mri is None:
            raise InvalidMetricsQueryError("Can't determine queried metrics without a MRI")

        return {timeseries.metric.mri}

    def _visit_number(self, number: float) -> set[str]:
        return set()

    def _visit_string(self, string: str) -> set[str]:
        return set()


class UsedGroupBysVisitor(QueryExpressionVisitor[set[str]]):
    """
    Visitor that recursively computes all the groups of the `QueryExpression`.
    """

    def _visit_formula(self, formula: Formula) -> set[str]:
        group_bys: set[str] = set()

        for parameter in formula.parameters:
            group_bys.union(self.visit(parameter))

        return group_bys.union(self._group_bys_as_string(formula.groupby))

    def _visit_timeseries(self, timeseries: Timeseries) -> set[str]:
        return self._group_bys_as_string(timeseries.groupby)

    def _visit_number(self, number: float) -> set[str]:
        return set()

    def _visit_string(self, string: str) -> set[str]:
        return set()

    def _group_bys_as_string(self, group_bys: list[Column | AliasedExpression] | None) -> set[str]:
        if not group_bys:
            return set()

        string_group_bys = set()
        for group_by in group_bys:
            if isinstance(group_by, AliasedExpression):
                string_group_bys.add(group_by.exp.name)
            elif isinstance(group_by, Column):
                string_group_bys.add(group_by.name)

        return string_group_bys


class ExpansionVisitor(QueryExpressionVisitor[QueryExpression]):
    """
    Visitor that recursively expands expressions that are defined in the `ExpressionRegistry`.
    """

    def __init__(self, registry: ExpressionRegistry):
        self._registry = registry

    def _visit_formula(self, formula: Formula) -> QueryExpression:
        registry_entry = self._registry.try_resolve(formula.function_name)
        if registry_entry is None:
            return super()._visit_formula(formula)

        # We concatenate arguments following the syntactical order function(param_1, param_2)(param_3) which would
        # result in a list of arguments [param_1, param_2, param_3].
        arguments = (formula.aggregate_params or []) + (formula.parameters or [])
        expression = registry_entry.expression()
        # For now, we assume that formula-level filters and group bys are not used, and instead they are directly
        # specified in the supplied expressions in the parameters.
        expression = ReplacementVisitor(arguments=arguments).visit(expression)

        # We recursively run substitutions in the newly created tree. We need to be careful about possible infinite
        # recursion.
        return self.visit(expression)

    def _visit_timeseries(self, timeseries: Timeseries) -> QueryExpression:
        registry_entry = self._registry.try_resolve(timeseries.aggregate)
        if registry_entry is None:
            return timeseries

        # We concatenate arguments following the syntactical order function(param_1, param_2)(mri_1) which would result
        # in a list of arguments [param_1, param_2, mri_1].
        arguments = (timeseries.aggregate_params or []) + [timeseries.metric]
        expression = registry_entry.expression()
        expression = ReplacementVisitor(
            arguments=arguments, filters=timeseries.filters, group_bys=timeseries.groupby
        ).visit(expression)

        # We recursively run substitutions in the newly created tree. We need to be careful about possible infinite
        # recursion.
        return self.visit(expression)


class ReplacementVisitor(QueryExpressionVisitor[QueryExpression]):
    """
    Visitor that recursively replaces `Placeholder` elements with the correct values.
    """

    def __init__(
        self,
        arguments: Sequence[Any],
        filters: ConditionGroup | None = None,
        group_bys: Sequence[Column | AliasedExpression] | None = None,
    ):
        self._arguments = arguments
        self._filters = filters
        self._group_bys = group_bys

    def _visit_formula(self, formula: Formula) -> QueryExpression:
        replaced_parameters = []
        for parameter in formula.parameters:
            if isinstance(parameter, Argument):
                replaced_parameters.append(self._visit_argument(parameter))
            else:
                replaced_parameters.append(self.visit(parameter))

        # TODO: implement merging also for timeseries.
        merged_filters = self._merge_filters(formula.filters)
        if merged_filters:
            formula = formula.set_filters(self._merge_filters(formula.filters))

        merged_group_bys = self._merge_group_bys(formula.groupby)
        if merged_group_bys:
            formula = formula.set_groupby(self._merge_group_bys(formula.groupby))

        return formula.set_parameters(replaced_parameters)

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

        return timeseries

    def _visit_argument(self, argument: Argument) -> Any:
        if argument.position >= len(self._arguments):
            raise InvalidMetricsQueryError(f"Argument at position {argument.position} not found")

        arg_value = self._arguments[argument.position]
        if not argument.validate(arg_value):
            raise InvalidMetricsQueryError(f"Argument at position {argument.position} not valid")

        return arg_value

    def _merge_filters(self, filters: ConditionGroup | None) -> ConditionGroup | None:
        return []

    def _merge_group_bys(
        self, group_bys: Sequence[Column | AliasedExpression] | None
    ) -> Sequence[Column | AliasedExpression] | None:
        return []
