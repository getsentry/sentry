"""
Utilities for transforming expressions and queries.
"""

from abc import ABC, abstractmethod
from typing import Generic, TypeVar, Union

from sentry.sentry_metrics.query_experimental.types import (
    FILTER,
    Column,
    Condition,
    Expression,
    Function,
    InvalidMetricsQuery,
    SeriesQuery,
)

QueryNode = Union[SeriesQuery, Expression]
TVisited = TypeVar("TVisited")


class QueryVisitor(ABC, Generic[TVisited]):
    """
    Visitor base class for metric series queries.

    Call `visit` on any node to visit it. The visitor will dispatch to the
    appropriate `visit_*` method based on the type of the node.
    """

    def visit(self, node: QueryNode) -> TVisited:
        if isinstance(node, SeriesQuery):
            return self._visit_query(node)
        if isinstance(node, Function):
            if node.function == FILTER:
                return self._visit_filter(node)
            return self._visit_function(node)
        elif isinstance(node, Condition):
            return self._visit_condition(node)
        elif isinstance(node, Column):
            return self._visit_column(node)
        elif isinstance(node, str):
            return self._visit_str(node)
        elif isinstance(node, int):
            return self._visit_int(node)
        elif isinstance(node, float):
            return self._visit_float(node)
        else:
            raise InvalidMetricsQuery(f"Expected metrics expression, received {type(node)}")

    @abstractmethod
    def _visit_query(self, query: SeriesQuery) -> TVisited:
        raise NotImplementedError()

    @abstractmethod
    def _visit_filter(self, filt: Function) -> TVisited:
        raise NotImplementedError()

    @abstractmethod
    def _visit_condition(self, condition: Condition) -> TVisited:
        raise NotImplementedError()

    @abstractmethod
    def _visit_function(self, function: Function) -> TVisited:
        raise NotImplementedError()

    @abstractmethod
    def _visit_column(self, column: Column) -> TVisited:
        raise NotImplementedError()

    @abstractmethod
    def _visit_str(self, string: str) -> TVisited:
        raise NotImplementedError()

    @abstractmethod
    def _visit_int(self, value: int) -> TVisited:
        raise NotImplementedError()

    @abstractmethod
    def _visit_float(self, value: float) -> TVisited:
        raise NotImplementedError()


class QueryTransform(QueryVisitor[QueryNode]):
    """
    Base class for query transform visitors.

    Recursively visits all expressions, filters, and groups in a query and
    returns a new query with the results of the transform. The default
    implementation is an identity transform.
    """

    def _visit_query(self, query: SeriesQuery) -> SeriesQuery:
        return SeriesQuery(
            expressions=[self.visit(exp) for exp in query.expressions],
            filters=[self.visit(filt) for filt in query.filters],
            groups=[self.visit(group) for group in query.groups],
            start=query.start,
            end=query.end,
            interval=query.interval,
        )

    def _visit_filter(self, filt: Function) -> Function:
        if not filt.parameters:
            raise InvalidMetricsQuery("Missing filter parameters")

        (inner, *conditions) = filt.parameters
        visited_inner = self.visit(inner)
        visited_conditions = (self.visit(cond) for cond in conditions)

        return Function(
            function=filt.function,
            parameters=[visited_inner, *visited_conditions],
        )

    def _visit_condition(self, condition: Condition) -> Condition:
        return Condition(
            lhs=self.visit(condition.lhs),
            op=condition.op,
            rhs=self.visit(condition.rhs),
        )

    def _visit_function(self, function: Function) -> Function:
        return Function(
            function=function.function,
            parameters=[self.visit(param) for param in function.parameters],
        )

    def _visit_column(self, column: Column) -> Column:
        return column

    def _visit_str(self, string: str) -> str:
        return string

    def _visit_int(self, value: int) -> int:
        return value

    def _visit_float(self, value: float) -> float:
        return value
