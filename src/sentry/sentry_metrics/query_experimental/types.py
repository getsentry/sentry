"""
Types to construct a metrics query request.
"""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Mapping, Optional, Sequence

from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.expressions import Expression
from snuba_sdk.function import Function

__all__ = (
    "AggregationFn",
    "ArithmeticFn",
    "Column",
    "Condition",
    "Expression",
    "FILTER",
    "Function",
    "InvalidMetricsQuery",
    "SeriesQuery",
)


class AggregationFn(Enum):
    """
    Valid aggregation functions for metrics queries to be used with ``Function``.
    """

    SUM = "sum"
    COUNT = "count"
    AVG = "avg"
    MAX = "max"
    MIN = "min"
    P50 = "p50"
    P75 = "p75"
    P95 = "p95"
    P99 = "p99"
    RATE = "rate"


class ArithmeticFn(Enum):
    """
    Valid arithmetic functions for metrics queries to be used with ``Function``.
    """

    PLUS = "plus"
    MINUS = "minus"
    MULTIPLY = "multiply"
    DIVIDE = "divide"


# Function name used for filtering.
FILTER = "filter"


@dataclass(frozen=True)
class SeriesQuery:
    """
    A metrics query that resolves time series.
    """

    # Metric expressions to resolve.
    expressions: Sequence[Expression]
    # A set of conditions to filter the time series specified by expressions by.
    # This is a shorthand for wrapping every one of the expressions in the
    # specified filters.
    filters: Sequence[Condition]
    # A set of tag names to group the time series specified by expressions by.
    groups: Sequence[Column]
    # The inclusive start of the time range to query.
    start: datetime
    # The exclusive end of the time range to query.
    end: datetime
    # The interval for each of the data points in the returned timeseries.
    interval: Optional[int]

    @classmethod
    def parse(cls, dsl: str, params: Optional[Mapping[str, Any]]) -> "SeriesQuery":
        """
        Parses a metrics query from a string.
        """
        raise NotImplementedError("TODO")


class InvalidMetricsQuery(Exception):
    """
    Raised during validation or execution when a metrics query is invalid.
    """

    pass


class SeriesResult:
    """
    A result of a metrics query.
    """

    pass


# TODO: Validators as visitor?


def validate_series_query(query: SeriesQuery):
    """
    Checks the syntactic components of a series and raises an
    ``InvalidMetricsQuery`` if the query is invalid.
    """

    for expression in query.expressions:
        _validate_expression(expression)

    for filt in query.filters:
        _validate_condition(filt)

    if not query.start or not query.end:
        raise InvalidMetricsQuery("No valid time range specified in query")

    if query.start > query.end:
        raise InvalidMetricsQuery("Start must be before end.")

    if query.interval and query.interval <= 0:
        raise InvalidMetricsQuery("Interval must be positive.")


def _validate_expression(expression: Expression):
    if isinstance(expression, Function):
        _validate_function(expression)
    elif isinstance(expression, Column):
        _validate_column(expression)
    elif isinstance(expression, (str, int, float)):
        pass  # leaf node
    else:
        raise InvalidMetricsQuery(f"Expected metrics expression, received {type(expression)}")


def _validate_function(function: Function):
    # Filters are special built-in functions with separate AST types.
    if function.function == FILTER:
        _validate_filter(function)
        return

    if not function.function:
        raise InvalidMetricsQuery("Function name must be specified")

    for parameter in function.parameters:
        _validate_expression(parameter)


def _validate_filter(function: Function):
    if function.function != FILTER:
        raise InvalidMetricsQuery(f"Expected filter function, received {function.function}")

    if not function.parameters:
        raise InvalidMetricsQuery("Missing filter parameters")

    (expression, *conditions) = function.parameters
    _validate_expression(expression)
    for condition in conditions:
        _validate_condition(conditions)


def _validate_column(column: Column):
    if not column.column:
        raise InvalidMetricsQuery("Column name must be specified")

    # TODO: Anything else here?


def _validate_condition(condition: Condition):
    # Conditions have a rigid structure at this moment. LHS must be a column,
    # operator must be a comparison operator, and RHS must be a scalar.

    if not isinstance(condition.lhs, Column):
        raise InvalidMetricsQuery("LHS of filter condition must be a column")

    if condition.op in (Op.EQ, Op.NEQ, Op.LIKE, Op.NOT_LIKE):
        _validate_condition_value(condition.rhs)
    elif condition.op in (Op.IN, Op.NOT_IN):
        if not isinstance(condition.rhs, (list, tuple)):
            raise InvalidMetricsQuery("RHS of IN condition must be a list or tuple")
        for value in condition.rhs:
            _validate_condition_value(value)
    else:
        raise InvalidMetricsQuery(f"Unsupported filter condition {condition.op}")


def _validate_condition_value(value: Any):
    if isinstance(value, Column):
        # TODO: Should this be moved to a conditional stage?
        if not is_variable(value):
            raise InvalidMetricsQuery("Filters must be a scalar value or variable")
    elif not isinstance(value, str):
        raise InvalidMetricsQuery("Filters must be a scalar value or variable")


def is_variable(column: Column) -> bool:
    return column.name.startswith("$")


def __example_to_remove():
    """
    sum(transactions{status="error"}) / sum(transactions)
    """

    expr = Function(
        ArithmeticFn.DIVIDE.value,
        [
            Function(
                AggregationFn.SUM.value,
                [
                    Function(
                        FILTER,
                        [
                            Column("transactions"),
                            Condition(
                                lhs=Column("status"),
                                op=Op.EQ,
                                rhs="error",
                            ),
                        ],
                    )
                ],
            ),
            Function(AggregationFn.SUM.value, [Column("transactions")]),
        ],
    )

    query = SeriesQuery(
        expressions=[expr],
        filters=[],
        groups=[],
        start=datetime(2023, 1, 1),
        end=datetime(2023, 1, 2),
        interval=3600,
    )

    validate_series_query(query)
