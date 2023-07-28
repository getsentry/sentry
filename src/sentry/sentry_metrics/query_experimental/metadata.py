"""
Facilities to determine metadata about metrics expressions.
"""

from abc import ABC
from dataclasses import dataclass
from typing import Any, Mapping, Sequence

from sentry.sentry_metrics.use_case_id_registry import UseCaseID

from .pipeline import QueryLayer
from .transform import QueryNode, QueryVisitor
from .types import (
    FILTER,
    AggregationFn,
    ArithmeticFn,
    Column,
    Condition,
    Expression,
    Function,
    InvalidMetricsQuery,
    Op,
    SeriesQuery,
    parse_mri,
)


class ValidationLayer(QueryLayer):
    """
    A query pipeline layer that checks if a query is structurally and
    semantically valid. The query is not modified by this layer.
    """

    def transform_query(self, query: SeriesQuery) -> SeriesQuery:
        annotate_query(query)  # just raise exceptions
        return query


def annotate_query(query: SeriesQuery) -> "AnnotatedQuery":
    """
    Annotate a query with metadata about the expressions and filters it
    contains.
    """

    annotated = TypeAnnotationTransform().visit(query)
    assert isinstance(annotated, AnnotatedQuery)
    return annotated


class ExpressionType(ABC):
    """
    The data type that an expression evaluates to in metrics queries.
    """

    pass


@dataclass(frozen=True)
class MetricType(ExpressionType):
    """
    The expression evaluates to a raw, unaggregated metric. This expression can
    be filtered and aggregated.

    :param aggregations: The aggregation functions that can be applied to this
        metric expression.
    """

    aggregations: Sequence[AggregationFn]


@dataclass(frozen=True)
class VectorType(ExpressionType):
    """
    The expression evaluates to a vector. This is the result of applying an
    aggregation function to a metric, but still contains tags and can be
    filtered.
    """

    pass


@dataclass(frozen=True)
class ScalarType(ExpressionType):
    """
    The expression evaluates to a scalar. This cannot be the result of a metric
    expression (yet), but it can be part of filter conditions.
    """

    pass


MRI_TYPES: Mapping[str, ExpressionType] = {
    "c": MetricType([AggregationFn.SUM]),
    "d": MetricType(
        [
            AggregationFn.COUNT,
            AggregationFn.AVG,
            AggregationFn.MAX,
            AggregationFn.MIN,
            AggregationFn.P50,
            AggregationFn.P75,
            AggregationFn.P95,
            AggregationFn.P99,
        ]
    ),
    "s": MetricType([AggregationFn.COUNT_UNIQUE]),
    "e": VectorType(),
}


class AnnotatedNode(ABC):
    """
    Base class for annotated query nodes. This is returned by the
    ``TypeAnnotationTransform``.
    """

    pass


@dataclass(frozen=True)
class AnnotatedExpression(AnnotatedNode):
    """
    A query expression annotated with its return type.
    """

    node: QueryNode
    type_: ExpressionType


@dataclass(frozen=True)
class AnnotatedQuery(AnnotatedNode):
    """
    A query with annotated expressions the return types of its expressions.

    :param query: The original query.
    :param expressions: The annotated expressions in the same order as in the
        query. Each of the annotated expressions also references the original
        expression.
    :param use_case: The single use case that the query operates on.
    """

    query: SeriesQuery
    expressions: Sequence[AnnotatedExpression]
    use_case: UseCaseID


class TypeAnnotationTransform(QueryVisitor[AnnotatedNode]):
    """
    A query visitor that annotates the query and each expression with its return
    type and validates all filters.
    """

    def __init__(self):
        self._use_case = None

    def _visit_expression(self, node: Expression) -> AnnotatedExpression:
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

        raise InvalidMetricsQuery(f"Expected metrics expression, received {type(node)}")

    def _visit_query(self, query: SeriesQuery) -> AnnotatedQuery:
        self._validate_scope(query)
        self._validate_timerange(query)

        # The use case is set when visiting a metric column, so if it is not
        # set at this point, there are no metrics in the query.
        expressions = [self._visit_expression(e) for e in query.expressions]
        if self._use_case is None:
            raise InvalidMetricsQuery("No metrics in query")

        for filt in query.filters:
            self._validate_filter_condition(filt)

        return AnnotatedQuery(
            query=query,
            expressions=expressions,
            use_case=self._use_case,
        )

    def _visit_filter(self, filt: Function) -> AnnotatedExpression:
        return self._annotate_filter(filt)

    def _visit_condition(self, condition: Condition) -> AnnotatedExpression:
        raise NotImplementedError()

    def _visit_function(self, function: Function) -> AnnotatedExpression:
        if function.function in ArithmeticFn:
            return self._annotate_arithmetic(function)
        elif function.function in AggregationFn:
            return self._annotate_aggregation(function)
        else:
            raise InvalidMetricsQuery(f"Unsupported function {function.function}")

    def _visit_column(self, column: Column) -> AnnotatedExpression:
        # This is called from an expression tree but not from a condition.
        #
        # TODO: Change the Visitor ABC so that there are different methods.
        return self._annotate_metric(column)

    def _visit_str(self, value: str) -> AnnotatedExpression:
        return AnnotatedExpression(node=value, type_=ScalarType())

    def _visit_int(self, value: int) -> AnnotatedExpression:
        return AnnotatedExpression(node=value, type_=ScalarType())

    def _visit_float(self, value: float) -> AnnotatedExpression:
        return AnnotatedExpression(node=value, type_=ScalarType())

    def _check_use_case(self, use_case: UseCaseID):
        if self._use_case is None:
            self._use_case = use_case
        elif self._use_case != use_case:
            raise InvalidMetricsQuery("All metrics in a query must belong to the same use case")

    def _annotate_filter(self, filt: Function) -> AnnotatedExpression:
        """
        Annotate a filter function.

        Filters can operate on both metrics and vectors, and return the same
        type as they wrap.
        """

        if not filt.parameters:
            raise InvalidMetricsQuery("Missing filter parameters")

        (inner, *conditions) = filt.parameters
        annotated_inner = self._visit_expression(inner)

        for cond in conditions:
            self._validate_filter_condition(cond)

        return AnnotatedExpression(
            node=filt,
            type_=annotated_inner.type_,
        )

    def _annotate_arithmetic(self, function: Function) -> AnnotatedExpression:
        """
        Annotate an arithmetic function.

        Arithmetic functions require vectors as parameters and return vectors.
        """

        if len(function.parameters) != 2:
            raise InvalidMetricsQuery(f"`{function.function}` must have two parameters")

        lhs = self._visit_expression(function.parameters[0])
        rhs = self._visit_expression(function.parameters[1])

        if not isinstance(lhs.type_, VectorType) or not isinstance(rhs.type_, VectorType):
            raise InvalidMetricsQuery(f"Cannot apply `{function.function}` to a metric")

        return AnnotatedExpression(
            node=function,
            type_=VectorType(),
        )

    def _annotate_aggregation(self, function: Function) -> AnnotatedExpression:
        try:
            aggregation_fn = AggregationFn(function.function)
        except ValueError:
            raise InvalidMetricsQuery(f"Unsupported aggregation function {function.function}")

        if len(function.parameters) != 1:
            raise InvalidMetricsQuery(f"`{function.function}` must have one parameter")

        inner = self._visit_expression(function.parameters[0])
        if not isinstance(inner.type_, MetricType):
            raise InvalidMetricsQuery(f"`{function.function}` requires a metric")

        if aggregation_fn not in inner.type_.aggregations:
            raise InvalidMetricsQuery(
                f"Cannot apply `{function.function}` to a {inner.type_} metric"
            )

        return AnnotatedExpression(
            node=function,
            type_=VectorType(),
        )

    def _annotate_metric(self, column: Column) -> AnnotatedExpression:
        mri = parse_mri(column.name)
        if mri.entity not in MRI_TYPES:
            raise InvalidMetricsQuery(f"Unknown metric type `{mri.entity}`")

        self._check_use_case(UseCaseID(mri.namespace))

        return AnnotatedExpression(
            node=column,
            type_=MRI_TYPES[mri.entity],
        )

    def _validate_filter_condition(self, condition: Condition) -> None:
        # Conditions have a rigid structure at this moment. LHS must be a column,
        # operator must be a comparison operator, and RHS must be a scalar.

        if not isinstance(condition.lhs, Column):
            raise InvalidMetricsQuery("LHS of filter condition must be a column")

        if condition.op in (Op.EQ, Op.NEQ, Op.LIKE, Op.NOT_LIKE):
            self._validate_condition_value(condition.rhs)
        elif condition.op in (Op.IN, Op.NOT_IN):
            if not isinstance(condition.rhs, (list, tuple)):
                raise InvalidMetricsQuery("RHS of IN condition must be a list or tuple")
            for value in condition.rhs:
                self._validate_condition_value(value)
        else:
            raise InvalidMetricsQuery(f"Unsupported filter condition {condition.op}")

    def _validate_condition_value(self, value: Any) -> None:
        if isinstance(value, Column):
            if self._is_variable(value):
                return
        elif isinstance(value, str):
            return

        raise InvalidMetricsQuery("Filters values must be a strings or variables")

    def _is_variable(self, column: Column) -> bool:
        return column.name.startswith("$")

    def _validate_timerange(self, query: SeriesQuery) -> None:
        if query.start > query.end:
            raise InvalidMetricsQuery("Start must be before end.")

        if query.interval <= 0:
            raise InvalidMetricsQuery("Interval must be positive.")

    def _validate_scope(self, query: SeriesQuery) -> None:
        if not query.scope.org_id or not query.scope.project_ids:
            raise InvalidMetricsQuery("Missing required organization or projects.")
