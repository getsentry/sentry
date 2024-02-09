from abc import ABC
from collections.abc import Mapping, Sequence
from typing import Generic, TypeVar

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

from sentry.api.serializers import bulk_fetch_project_latest_releases
from sentry.models.environment import Environment
from sentry.models.project import Project
from sentry.sentry_metrics.querying.errors import (
    InvalidMetricsQueryError,
    LatestReleaseNotFoundError,
)
from sentry.sentry_metrics.querying.types import QueryCondition, QueryExpression
from sentry.snuba.metrics import parse_mri

TVisited = TypeVar("TVisited")


class QueryExpressionVisitor(ABC, Generic[TVisited]):
    """
    Abstract visitor that defines a visiting behavior of a `QueryExpression`.
    """

    def visit(self, query_expression: QueryExpression) -> TVisited:
        if isinstance(query_expression, Formula):
            return self._visit_formula(query_expression)
        elif isinstance(query_expression, Timeseries):
            return self._visit_timeseries(query_expression)
        elif isinstance(query_expression, float):
            return self._visit_number(query_expression)
        elif isinstance(query_expression, str):
            return self._visit_string(query_expression)

        raise AssertionError(f"Unhandled query expression {query_expression}")

    def _visit_formula(self, formula: Formula) -> TVisited:
        # The default implementation just mutates the parameters of the `Formula`.
        parameters = []
        for parameter in formula.parameters:
            parameters.append(self.visit(parameter))

        return formula.set_parameters(parameters)

    def _visit_timeseries(self, timeseries: Timeseries) -> TVisited:
        raise timeseries

    def _visit_number(self, number: float):
        return number

    def _visit_string(self, string: str):
        return string


class QueryConditionVisitor(ABC, Generic[TVisited]):
    """
    Abstract visitor that defines a visiting behavior of a `QueryCondition`.
    """

    def visit_group(self, condition_group: ConditionGroup) -> ConditionGroup:
        if not condition_group:
            return condition_group

        visited_conditions = []
        for condition in condition_group:
            visited_conditions.append(self.visit(condition))

        return visited_conditions

    def visit(self, query_condition: QueryCondition) -> TVisited:
        if isinstance(query_condition, BooleanCondition):
            return self._visit_boolean_condition(query_condition)
        elif isinstance(query_condition, Condition):
            return self._visit_condition(query_condition)

        raise AssertionError(f"Unhandled query condition {query_condition}")

    def _visit_boolean_condition(self, boolean_condition: BooleanCondition) -> TVisited:
        conditions = []

        for condition in boolean_condition.conditions:
            conditions.append(self.visit(condition))

        return BooleanCondition(op=boolean_condition.op, conditions=conditions)

    def _visit_condition(self, condition: Condition) -> TVisited:
        raise condition


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


class ValidationVisitor(QueryExpressionVisitor[QueryExpression]):
    """
    Visitor that recursively validates the `QueryExpression`.
    """

    def _visit_timeseries(self, timeseries: Timeseries) -> QueryExpression:
        # This visitor has been kept in case we need future validations.
        return timeseries


class ValidationV2Visitor(QueryExpressionVisitor[QueryExpression]):
    """
    Visitor that recursively validates the `QueryExpression` of the new endpoint.
    """

    def __init__(self):
        self._query_namespace = None
        self._query_entity = None
        self._query_group_bys = None

    def _visit_formula(self, formula: Formula) -> QueryExpression:
        visited_formula = super()._visit_formula(formula)

        # Formulas can optionally not have group bys, since only leaf `Timeseries` nodes can have them,
        # thus we do not perform any validation in case they are not set.
        if formula.groupby is not None:
            self._validate_group_bys(formula.groupby)

        return visited_formula

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

        # If group bys are `None` for a `Timeseries`, we treat them as an empty list of group bys.
        self._validate_group_bys(timeseries.groupby or [])

        return timeseries

    def _validate_group_bys(self, group_bys: list[Column | AliasedExpression] | None):
        # We use a deduplicated and sorted representation of the group by fields used in the query, since
        # we need to understand whether the same groups are used even across `Column`(s) and `AliasedExpression`(s).
        sorted_group_bys = self._sort_group_bys(group_bys)
        if self._query_group_bys is None:
            self._query_group_bys = sorted_group_bys
        elif self._query_group_bys != sorted_group_bys:
            raise InvalidMetricsQueryError(
                "Querying metrics with different group bys is not allowed"
            )

    def _sort_group_bys(
        self, group_bys: list[Column | AliasedExpression] | None
    ) -> list[str] | None:
        def _column_name(group_by: Column | AliasedExpression) -> str:
            if isinstance(group_by, Column):
                return group_by.name
            elif isinstance(group_by, AliasedExpression):
                return group_by.exp.name

            return ""

        if group_bys is None:
            return None

        return list(set(map(_column_name, group_bys)))


class FiltersCompositeVisitor(QueryExpressionVisitor[QueryExpression]):
    """
    Visitor that runs a series of `QueryConditionVisitor`(s) on each filters of elements of a `QueryExpression`.
    """

    def __init__(self, *visitors: QueryConditionVisitor):
        self._visitors = list(visitors)

    def _visit_formula(self, formula: Formula) -> QueryExpression:
        # We call the super method in order to recursively visit all the parameters of a formula and then apply the
        # visitors on the filters of the formula itself.
        visited_formula = super()._visit_formula(formula)
        if not visited_formula.filters:
            return visited_formula

        return visited_formula.set_filters(
            self._apply_visitors_on_condition_group(visited_formula.filters)
        )

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


class LatestReleaseTransformationVisitor(QueryConditionVisitor[QueryCondition]):
    """
    Visitor that recursively transforms all the conditions in the form `release:latest` by transforming them to
    `release IN [x, y, ...]` where `x` and `y` are the latest releases belonging to the supplied projects.
    """

    def __init__(self, projects: Sequence[Project]):
        self._projects = projects

    def _visit_condition(self, condition: Condition) -> QueryCondition:
        if not isinstance(condition.lhs, Column):
            return condition

        if not (
            condition.lhs.name == "release"
            and isinstance(condition.rhs, str)
            and condition.rhs == "latest"
        ):
            return condition

        latest_releases = bulk_fetch_project_latest_releases(self._projects)
        if not latest_releases:
            raise LatestReleaseNotFoundError(
                "Latest release(s) not found for the supplied projects"
            )

        return Condition(
            lhs=condition.lhs,
            op=Op.IN,
            rhs=[latest_release.version for latest_release in latest_releases],
        )


class TagsTransformationVisitor(QueryConditionVisitor[QueryCondition]):
    """
    Visitor that recursively transforms all conditions to work on tags in the form `tags[x]`.
    """

    def __init__(self, check_sentry_tags: bool):
        self._check_sentry_tags = check_sentry_tags

    def _visit_condition(self, condition: Condition) -> QueryCondition:
        if not isinstance(condition.lhs, Column):
            return condition

        # We assume that all incoming conditions are on tags, since we do not allow filtering by project in the
        # query filters.
        tag_column = f"tags[{condition.lhs.name}]"
        sentry_tag_column = f"sentry_tags[{condition.lhs.name}]"

        if self._check_sentry_tags:
            tag_column = f"tags[{condition.lhs.name}]"
            # We might have tags across multiple nested structures such as `tags` and `sentry_tags` for this reason
            # we want to emit a condition that spans both.
            return BooleanCondition(
                op=BooleanOp.OR,
                conditions=[
                    Condition(lhs=Column(name=tag_column), op=condition.op, rhs=condition.rhs),
                    Condition(
                        lhs=Column(name=sentry_tag_column),
                        op=condition.op,
                        rhs=condition.rhs,
                    ),
                ],
            )
        else:
            return Condition(lhs=Column(name=tag_column), op=condition.op, rhs=condition.rhs)


class MappingTransformationVisitor(QueryConditionVisitor[QueryCondition]):
    """
    Visitor that recursively transforms all conditions whose `key` matches one of the supplied mappings. If found,
    replaces it with the mapped value.
    """

    def __init__(self, mappings: Mapping[str, str]):
        self._mappings = mappings

    def _visit_condition(self, condition: Condition) -> QueryCondition:
        if not isinstance(condition.lhs, Column):
            return condition

        return Condition(
            lhs=Column(name=self._mappings.get(condition.lhs.key, condition.lhs.name)),
            op=condition.op,
            rhs=condition.rhs,
        )


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
