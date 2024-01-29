from abc import ABC
from typing import Generic, Mapping, Optional, Sequence, TypeVar

from snuba_sdk import BooleanCondition, BooleanOp, Column, Condition, Formula, Op, Timeseries
from snuba_sdk.conditions import ConditionGroup

from sentry.api.serializers import bulk_fetch_project_latest_releases
from sentry.models.environment import Environment
from sentry.models.project import Project
from sentry.sentry_metrics.querying.errors import LatestReleaseNotFoundError
from sentry.sentry_metrics.querying.types import QueryCondition, QueryExpression

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

        raise AssertionError(f"Unhandled query expression {query_expression}")

    def _visit_formula(self, formula: Formula) -> TVisited:
        # The default implementation just mutates the parameters of the `Formula`.
        parameters = []
        for parameter in formula.parameters:
            parameters.append(self.visit(parameter))

        return formula.set_parameters(parameters)

    def _visit_timeseries(self, timeseries: Timeseries) -> TVisited:
        raise NotImplementedError


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
        raise NotImplementedError


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


class ValidationVisitor(QueryExpressionVisitor[QueryExpression]):
    """
    Visitor that recursively validates the query expression.
    """

    def _visit_timeseries(self, timeseries: Timeseries) -> QueryExpression:
        # This visitor has been kept in case we need future validations.
        return timeseries


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
        self, condition_group: Optional[ConditionGroup]
    ) -> Optional[ConditionGroup]:
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
