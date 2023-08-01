"""
Utilities for transforming expressions and queries.
"""

from abc import ABC, abstractmethod
from dataclasses import replace
from typing import Generic, List, Tuple, TypeVar, Union

from .types import (
    AggregationFn,
    ArithmeticFn,
    ConditionFn,
    Expression,
    Filter,
    Function,
    InvalidMetricsQuery,
    MetricName,
    SeriesQuery,
    Tag,
    Variable,
)

Primitive = Union[str, int, float, Tuple, List]
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
        elif isinstance(node, Filter):
            return self._visit_filter(node)
        elif isinstance(node, Function):
            if node.function in AggregationFn:
                return self._visit_aggregation(node)
            elif node.function in ArithmeticFn:
                return self._visit_arithmetic(node)
            elif node.function in ConditionFn:
                return self._visit_condition(node)
            else:
                return self._visit_function(node)
        elif isinstance(node, MetricName):
            return self._visit_metric(node)
        elif isinstance(node, Tag):
            return self._visit_tag(node)
        elif isinstance(node, Variable):
            return self._visit_variable(node)
        elif isinstance(node, (str, int, float, list, tuple)):
            return self._visit_literal(node)
        else:
            raise InvalidMetricsQuery(f"Expected metrics expression, received {type(node)}")

    @abstractmethod
    def _visit_query(self, query: SeriesQuery) -> TVisited:
        raise NotImplementedError()

    @abstractmethod
    def _visit_filter(self, filt: Filter) -> TVisited:
        raise NotImplementedError()

    @abstractmethod
    def _visit_aggregation(self, aggregation: Function) -> TVisited:
        raise NotImplementedError()

    @abstractmethod
    def _visit_arithmetic(self, arithmetic: Function) -> TVisited:
        raise NotImplementedError()

    @abstractmethod
    def _visit_condition(self, condition: Function) -> TVisited:
        raise NotImplementedError()

    @abstractmethod
    def _visit_function(self, function: Function) -> TVisited:
        raise NotImplementedError()

    @abstractmethod
    def _visit_metric(self, metric: MetricName) -> TVisited:
        raise NotImplementedError()

    @abstractmethod
    def _visit_tag(self, tag: Tag) -> TVisited:
        raise NotImplementedError()

    @abstractmethod
    def _visit_variable(self, variable: Variable) -> TVisited:
        raise NotImplementedError()

    @abstractmethod
    def _visit_literal(self, value: Union[str, int, float, Tuple, List]) -> TVisited:
        raise NotImplementedError()


class QueryTransform(QueryVisitor[QueryNode]):
    """
    Base class for query transform visitors.

    Recursively visits all expressions, filters, and groups in a query and
    returns a new query with the results of the transform. The default
    implementation is an identity transform.
    """

    def _visit_query(self, query: SeriesQuery) -> SeriesQuery:
        return replace(
            query,
            expressions=[self.visit(exp) for exp in query.expressions],
            filters=[self.visit(filt) for filt in query.filters],
            groups=[self.visit(group) for group in query.groups],
        )

    def _visit_filter(self, filt: Filter) -> Function:
        if not filt.parameters:
            raise InvalidMetricsQuery("Missing filter parameters")

        (inner, *conditions) = filt.parameters
        visited_inner = self.visit(inner)
        visited_conditions = (self._visit_condition(cond) for cond in conditions)

        return replace(filt, parameters=[visited_inner, *visited_conditions])

    def _visit_aggregation(self, aggregation: Function) -> Function:
        return self._visit_function(aggregation)

    def _visit_arithmetic(self, arithmetic: Function) -> Function:
        return self._visit_function(arithmetic)

    def _visit_condition(self, condition: Function) -> Function:
        return self._visit_function(condition)

    def _visit_function(self, function: Function) -> Function:
        visited = [self.visit(param) for param in function.parameters]
        return replace(function, parameters=visited)

    def _visit_metric(self, metric: MetricName) -> QueryNode:
        return metric

    def _visit_tag(self, tag: Tag) -> Tag:
        return tag

    def _visit_variable(self, variable: Variable) -> QueryNode:
        return variable

    def _visit_literal(self, value: Primitive) -> Primitive:
        return value
