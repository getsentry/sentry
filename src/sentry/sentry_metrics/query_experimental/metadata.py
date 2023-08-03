"""
Facilities to determine metadata about metrics expressions.
"""

from abc import ABC
from dataclasses import dataclass
from typing import Any, Mapping, Sequence

from sentry.sentry_metrics.use_case_id_registry import UseCaseID

from .pipeline import QueryLayer
from .transform import Primitive, QueryNode, QueryVisitor
from .types import (
    AggregationFn,
    ArithmeticFn,
    ConditionFn,
    Expression,
    Filter,
    Function,
    InvalidMetricsQuery,
    MetricName,
    MetricScope,
    SeriesQuery,
    SeriesRollup,
    Tag,
    TimeRange,
    Variable,
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

    def _visit_query(self, query: SeriesQuery) -> AnnotatedQuery:
        self._validate_scope(query.scope)
        self._validate_timeframe(query.range, query.rollup)

        # The use case is set when visiting a metric name, so if it is not
        # set at this point, there are no metrics in the query.
        expressions = [self._visit_expression(e) for e in query.expressions]
        if self._use_case is None:
            raise InvalidMetricsQuery("No metrics in query")

        for filt in query.filters:
            self._validate_filter_condition(filt)

        for tag in query.groups:
            self._validate_tag_key(tag)

        return AnnotatedQuery(
            query=query,
            expressions=expressions,
            use_case=self._use_case,
        )

    def _visit_expression(self, node: Expression) -> AnnotatedExpression:
        """
        Helper function that visits any expression node and returns the
        annotated expression as correct type. This delegates to :meth:`visit`.
        """

        annotated = self.visit(node)
        assert isinstance(annotated, AnnotatedExpression)
        return annotated

    def _visit_filter(self, filt: Filter) -> AnnotatedExpression:
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

    def _visit_aggregation(self, function: Function) -> AnnotatedExpression:
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

    def _visit_arithmetic(self, function: Function) -> AnnotatedExpression:
        """
        Annotate an arithmetic function.

        Arithmetic functions require vectors as parameters and return vectors.
        """

        op = function.function
        try:
            ArithmeticFn(op)
        except ValueError:
            raise InvalidMetricsQuery(f"Unsupported arithmetic function {op}")

        if len(function.parameters) != 2:
            raise InvalidMetricsQuery(f"`{op}` must have two parameters")

        lhs = self._visit_expression(function.parameters[0])
        rhs = self._visit_expression(function.parameters[1])
        self._validate_numeric(lhs, op)
        self._validate_numeric(rhs, op)

        return AnnotatedExpression(
            node=function,
            type_=VectorType(),
        )

    def _validate_numeric(self, node: AnnotatedExpression, op: str) -> None:
        if isinstance(node.type_, ScalarType):
            if not isinstance(node.node, (int, float)):
                raise InvalidMetricsQuery("Expected a numeric value")
        elif not isinstance(node.type_, VectorType):
            raise InvalidMetricsQuery(f"Cannot apply `{op}` to a metric, aggregation needed")

    def _visit_condition(self, condition: Function) -> AnnotatedExpression:
        raise InvalidMetricsQuery("Unexpected condition function")

    def _visit_function(self, function: Function) -> AnnotatedExpression:
        raise InvalidMetricsQuery(f"Unsupported function {function.function}")

    def _visit_variable(self, variable: Variable) -> AnnotatedExpression:
        # TODO: Get the story straight on variables
        raise InvalidMetricsQuery(f"Unbound variable {variable.name}")

    def _visit_tag(self, tag: Tag) -> AnnotatedExpression:
        raise InvalidMetricsQuery("Unexpected tag in metric position")

    def _visit_metric(self, metric: MetricName) -> AnnotatedExpression:
        mri = parse_mri(metric.name)
        if mri.entity not in MRI_TYPES:
            raise InvalidMetricsQuery(f"Unknown metric type `{mri.entity}`")

        self._check_use_case(UseCaseID(mri.namespace))

        return AnnotatedExpression(
            node=metric,
            type_=MRI_TYPES[mri.entity],
        )

    def _check_use_case(self, use_case: UseCaseID):
        if self._use_case is None:
            self._use_case = use_case
        elif self._use_case != use_case:
            raise InvalidMetricsQuery("All metrics in a query must belong to the same use case")

    def _visit_literal(self, value: Primitive) -> AnnotatedExpression:
        return AnnotatedExpression(node=value, type_=ScalarType())

    def _validate_filter_condition(self, condition: Function) -> None:
        # Conditions have a rigid structure at this moment. LHS (first
        # parameter) must be a tag, and RHS (second parameter) must be a
        # scalar. There cannot be boolean operators in conditions.

        try:
            op = ConditionFn(condition.function)
        except ValueError:
            raise InvalidMetricsQuery(f"Unsupported filter condition {condition.function}")

        value_type = op.value_type
        params = 1 if value_type == "none" else 2
        if len(condition.parameters) != params:
            raise InvalidMetricsQuery(f"Filter {op} condition must have {params} parameters")

        self._validate_tag_key(condition.parameters[0])

        if value_type == "scalar":
            self._validate_condition_value(condition.parameters[1])
        elif value_type == "tuple":
            rhs = condition.parameters[1]
            if not isinstance(rhs, (list, tuple)):
                raise InvalidMetricsQuery("RHS of IN condition must be a list or tuple")
            for value in rhs:
                self._validate_condition_value(value)
        else:
            assert value_type == "none"

    def _validate_tag_key(self, key: Any) -> None:
        if isinstance(key, Variable):
            raise InvalidMetricsQuery(f"Unbound variable {key.name}")
        if not isinstance(key, Tag):
            raise InvalidMetricsQuery(
                f"LHS of filter condition must be a tag, received {type(key)}"
            )

    def _validate_condition_value(self, value: Any) -> None:
        if not isinstance(value, (str, Variable)):
            raise InvalidMetricsQuery("Filters values must be a strings or variables")

    def _validate_timeframe(self, range_: TimeRange, rollup: SeriesRollup) -> None:
        if range_.start > range_.end:
            raise InvalidMetricsQuery("Start must be before end.")

        if rollup.interval is None:
            return

        if rollup.interval == "auto":
            raise InvalidMetricsQuery("Query has an unresolved time interval, missing layer.")

        if rollup.interval <= 0:
            raise InvalidMetricsQuery("Interval must be positive.")

        if (range_.end - range_.start).total_seconds() % rollup.interval != 0:
            raise InvalidMetricsQuery("Time range doesn't align with interval, missing layer.")

    def _validate_scope(self, scope: MetricScope) -> None:
        if not scope.org_id or not scope.project_ids:
            raise InvalidMetricsQuery("Missing required organization or projects.")
