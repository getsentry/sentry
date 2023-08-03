"""
Builder for series queries.

The main entry points are ``E`` and ``Q`` to construct expressions and queries,
respectively.
"""

from dataclasses import replace
from datetime import datetime
from typing import Dict, List, Optional, Sequence, Tuple, Union

from .dsl import parse_expression
from .types import (
    AggregationFn,
    ArithmeticFn,
    ConditionFn,
    Expression,
    Filter,
    Function,
    MetricName,
    MetricScope,
    SeriesQuery,
    SeriesResult,
    SeriesRollup,
    Tag,
    TimeRange,
    Variable,
)


def _create_condition(
    tag: Union[str, Tag],
    op: Union[str, ConditionFn],
    value: Union[str, List, Tuple],
) -> Function:
    rhs: Expression = value
    if isinstance(value, str) and value.startswith("$"):
        rhs = Variable(value[1:])

    fn = ConditionFn(op).value
    lhs = tag if isinstance(tag, Tag) else Tag(tag)
    return Function(fn, [lhs, rhs])


Initializer = Union[str, int, float, Expression, "E"]


class E:
    """
    Builder for series query expressions.

    The builder is immutable and can be reused to build multiple expressions.
    Pass the builder directly to ``Q.expr`` to add the expression to a query, or
    use ``build`` to obtain the expression.
    """

    expr: Expression

    def __init__(self, initializer: Initializer):
        """
        Creates a new expression builder.

        By default, the argument passed to the constructor should be a string
        referring to the metric name. The name can start with a `$`, in which
        case it is interpreted as a variable name.

        Alternatively, it is possible to initialize the builder with an existing
        expression. The builder never mutates the expression, so it is safe to
        reuse the same expression in multiple builders.
        """

        if isinstance(initializer, E):
            self.expr = initializer.expr
        elif isinstance(initializer, str):
            if initializer.startswith("$"):
                self.expr = Variable(initializer[1:])
            else:
                self.expr = MetricName(initializer)
        elif isinstance(initializer, (int, float)):
            self.expr = initializer
        elif isinstance(initializer, Expression):
            self.expr = initializer
        else:
            raise TypeError(f"Expected str or Expression, got {type(initializer)}")

    def clone(self) -> "E":
        """
        Returns a clone of the current builder.
        """
        return E(self)

    def build(self) -> Expression:
        """
        Builds the final expression
        """
        return self.expr

    def filter(
        self,
        tag: Union[str, Tag],
        op: Union[str, ConditionFn],
        value: Union[str, List, Tuple],
    ) -> "E":
        """
        Wraps the expression with a filter for a tag.

        Depending on the operator, the value should be a string or a tuple.
        Alternatively, a string prefixed by `$` can be used to refer to a
        variable.
        """

        condition = _create_condition(tag, op, value)
        if isinstance(self.expr, Filter):
            return E(Filter(self.expr.parameters + [condition]))
        else:
            return E(Filter([self.expr, condition]))

    def agg(self, op: Union[AggregationFn, str]) -> "E":
        """
        Apply an aggregation function to the expression.
        """
        fn = AggregationFn(op).value
        return E(Function(fn, [self.expr]))

    def sum(self) -> "E":
        """
        Shorthand for ``agg("sum")``.
        """
        return self.agg(AggregationFn.SUM)

    def count(self) -> "E":
        """
        Shorthand for ``agg("count")``.
        """
        return self.agg(AggregationFn.COUNT)

    def avg(self) -> "E":
        """
        Shorthand for ``agg("avg")``.
        """
        return self.agg(AggregationFn.AVG)

    def max(self) -> "E":
        """
        Shorthand for ``agg("max")``.
        """
        return self.agg(AggregationFn.MAX)

    def min(self) -> "E":
        """
        Shorthand for ``agg("min")``.
        """
        return self.agg(AggregationFn.MIN)

    def p50(self) -> "E":
        """
        Shorthand for ``agg("p50")``.
        """
        return self.agg(AggregationFn.P50)

    def p75(self) -> "E":
        """
        Shorthand for ``agg("p75")``.
        """
        return self.agg(AggregationFn.P75)

    def p95(self) -> "E":
        """
        Shorthand for ``agg("p95")``.
        """
        return self.agg(AggregationFn.P95)

    def p99(self) -> "E":
        """
        Shorthand for ``agg("p99")``.
        """
        return self.agg(AggregationFn.P99)

    def count_unique(self) -> "E":
        """
        Shorthand for ``agg("count_unique")``.
        """
        return self.agg(AggregationFn.COUNT_UNIQUE)

    def calc(self, op: Union[ArithmeticFn, str], other: Initializer) -> "E":
        """
        Apply an arithmetic function to the expression.

        This expression is used as the left-hand side of the operation. The
        right-hand can be an expression builder or anything that can be supplied
        to the constructor of the builder.

        Example::

            E("$foo").calc("plus", 1)
            E("$foo").calc("plus", "$bar")
            E("$foo").calc("plus", E("$bar").count())
        """

        fn = ArithmeticFn(op).value
        return E(Function(fn, [self.expr, E(other).expr]))

    def plus(self, other: Union[str, Expression, "E"]) -> "E":
        """
        Shorthand for ``calc("plus", other)``.
        """
        return self.calc(ArithmeticFn.PLUS, other)

    def minus(self, other: Union[str, Expression, "E"]) -> "E":
        """
        Shorthand for ``calc("minus", other)``.
        """
        return self.calc(ArithmeticFn.MINUS, other)

    def multiply(self, other: Union[str, Expression, "E"]) -> "E":
        """
        Shorthand for ``calc("multiply", other)``.
        """
        return self.calc(ArithmeticFn.MULTIPLY, other)

    def divide(self, other: Union[str, Expression, "E"]) -> "E":
        """
        Shorthand for ``calc("divide", other)``.
        """
        return self.calc(ArithmeticFn.DIVIDE, other)


class Q:
    """
    Builder to incrementally construct metrics series queries.

    It is required to provide the following components:
     - at least one expression
     - an explicit scope
     - the time range

    Example::

        query = (
            Q()
            .expr("avg(`d:transactions/duration@millisecond`)")
            .scope(org_id=1, project_ids=[1])
            .last(hours=1)
            .build()
        )
    """

    def __init__(self):
        self._scope: Optional[MetricScope] = None
        self._range: Optional[TimeRange] = None
        self._rollup: SeriesRollup = SeriesRollup()
        self._expressions: List[Expression] = []
        self._filters: List[Function] = []
        self._groups: List[Tag] = []
        self._params: Optional[Dict[str, Expression]] = None

    def scope(self, org_id: int, project_ids: Sequence[int]) -> "Q":
        """
        Set the scope of the query.
        """
        self._scope = MetricScope(org_id, project_ids)
        return self

    def range(self, start: datetime, end: datetime) -> "Q":
        """
        Query the specified time range. The end time is exclusive.
        """
        self._range = TimeRange(start, end)
        return self

    def start_at(self, start: datetime, days=0, hours=0, minutes=0, seconds=0) -> "Q":
        """
        Query starting at the provided time for the specified duration.
        """
        self._range = TimeRange.start_at(start, days, hours, minutes, seconds)
        return self

    def end_at(self, end: datetime, days=0, hours=0, minutes=0, seconds=0) -> "Q":
        """
        Query ending at the provided time for the specified duration.
        """
        self._range = TimeRange.end_at(end, days, hours, minutes, seconds)
        return self

    def since(self, start: datetime) -> "Q":
        """
        Query starting at the provided time until now.
        """
        self._range = TimeRange.since(start)
        return self

    def last(self, days=0, hours=0, minutes=0, seconds=0) -> "Q":
        """
        Query for the specified duration until now.
        """
        self._range = TimeRange.last(days, hours, minutes, seconds)
        return self

    def interval(
        self,
        seconds: Optional[int],
        minutes: Optional[int],
        hours: Optional[int],
        days: Optional[int],
    ) -> "Q":
        """
        Sets an explicit rollup interval on the query. The default is to
        auto-infer the interval based on the chosen time range.

        Note, only one of the interval components can be provided.

        Example::
            query = Q().interval(3600)
            query = Q().interval(hours=1)
        """
        if seconds is not None:
            interval = seconds
        elif minutes is not None:
            interval = minutes * 60
        elif hours is not None:
            interval = hours * 60 * 60
        elif days is not None:
            interval = days * 24 * 60 * 60
        else:
            raise AttributeError("Must provide at one interval component")

        self._rollup = replace(self._rollup, interval=interval)
        return self

    def include_totals(self) -> "Q":
        """
        Include rollups on the total time range in the result.
        """

        self._rollup = replace(self._rollup, totals=True)
        return self

    def totals_only(self) -> "Q":
        """
        Return just rollups on the total time range in the result without a time
        series.
        """
        self._rollup = SeriesRollup.totals_only()
        return self

    def expr(self, initializer: Union[str, Expression, E]) -> "Q":
        """
        Add an expression to the query.

        If the initializer is a string, it is interpreted as MQL (metrics query
        language) and parsed into an expression. Refer to ``parse_expression``
        for syntax.

        Otherwise, the passed expression is used directly. To construct complex
        expressions, use and pass an instance of the `E` expression builder.

        Example::

            query = (
                Q()
                .expr("sum(foo) * 10")
                .expr(E("bar").count())
                .build()
            )
        """

        if isinstance(initializer, str):
            initializer = parse_expression(initializer)

        self._expressions.append(E(initializer).build())
        return self

    def filter(
        self,
        tag: Union[str, Tag],
        op: Union[str, ConditionFn],
        value: Union[str, List, Tuple],
    ) -> "Q":
        """
        Add a filter that applies to all expressions that are or will be added.
        """

        condition = _create_condition(tag, op, value)
        self._filters.append(condition)
        return self

    def group(self, tag: Union[str, Tag]) -> "Q":
        """
        Add a grouping to the query.
        """

        self._groups.append(tag if isinstance(tag, Tag) else Tag(tag))
        return self

    def bind(self, **params: Expression) -> "Q":
        """
        Bind the specified variables to this query.

        This can be called multiple times to add more variable bindings.
        Previous bindings will be overwritten for duplicate variables.

        Example::

            query = (
                Q()
                .expr("sum(metric) * $multiplier")
                .bind(multiplier=10)
                .build()
            )
        """
        if params:
            if not self._params:
                self._params = params
            else:
                self._params.update(params)

        return self

    def build(self) -> SeriesQuery:
        """
        Build the query.
        """

        if self._scope is None:
            raise ValueError("Scope is required")

        if self._range is None:
            raise ValueError("Range is required")

        if not self._expressions:
            raise ValueError("At least one expression is required")

        query = SeriesQuery(
            scope=self._scope,
            range=self._range,
            expressions=self._expressions,
            filters=self._filters,
            groups=self._groups,
            rollup=self._rollup,
        )

        if self._params is not None:
            query = query.bind(**self._params)

        return query

    def query(self) -> SeriesResult:
        """
        Execute the query against the default backend.
        """
        from . import get_series

        return get_series(self.build())
