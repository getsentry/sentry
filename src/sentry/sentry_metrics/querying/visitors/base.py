from abc import ABC
from typing import Generic, TypeVar

from snuba_sdk import BooleanCondition, Condition, Formula, Timeseries
from snuba_sdk.conditions import ConditionGroup

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
        elif isinstance(query_expression, int):
            return self._visit_int(query_expression)
        elif isinstance(query_expression, float):
            return self._visit_float(query_expression)
        elif isinstance(query_expression, str):
            return self._visit_string(query_expression)

        raise AssertionError(
            f"Unhandled query expression {query_expression} of type {type(query_expression)}"
        )

    def _visit_formula(self, formula: Formula) -> TVisited:
        # The default implementation just mutates the parameters of the `Formula`.
        parameters = []
        for parameter in formula.parameters:
            parameters.append(self.visit(parameter))

        return formula.set_parameters(parameters)

    def _visit_timeseries(self, timeseries: Timeseries) -> TVisited:
        raise timeseries

    def _visit_int(self, int_number: float) -> TVisited:
        return int_number

    def _visit_float(self, float_number: float) -> TVisited:
        return float_number

    def _visit_string(self, string: str) -> TVisited:
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

        raise AssertionError(
            f"Unhandled query condition {query_condition} of type {type(query_condition)}"
        )

    def _visit_boolean_condition(self, boolean_condition: BooleanCondition) -> TVisited:
        conditions = []

        for condition in boolean_condition.conditions:
            conditions.append(self.visit(condition))

        return BooleanCondition(op=boolean_condition.op, conditions=conditions)

    def _visit_condition(self, condition: Condition) -> TVisited:
        raise condition


class VisitableQueryExpression:
    def __init__(self, query: QueryExpression):
        self._query = query
        self._visitors: list[QueryExpressionVisitor[QueryExpression]] = []

    def add_visitor(
        self, visitor: QueryExpressionVisitor[QueryExpression]
    ) -> "VisitableQueryExpression":
        """
        Adds a visitor to the query expression.

        The visitor can both perform mutations or not on the expression tree.
        """
        self._visitors.append(visitor)

        return self

    def get(self) -> QueryExpression:
        """
        Returns the mutated query expression after running all the visitors
        in the order of definition.

        Order preservation does matter, since downstream visitors might work under the
        assumption that upstream visitors have already been run.
        """
        query = self._query
        for visitor in self._visitors:
            query = visitor.visit(query)

        return query
