"""
Types to construct a metrics query request.
"""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Mapping, Optional, Sequence

from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.expressions import Expression
from snuba_sdk.function import Function

from sentry.snuba.metrics.naming_layer import ParsedMRI
from sentry.snuba.metrics.naming_layer import parse_mri as _parse_mri

__all__ = (
    "AggregationFn",
    "ArithmeticFn",
    "Column",
    "Condition",
    "Expression",
    "FILTER",
    "Function",
    "InvalidMetricsQuery",
    "MetricQueryScope",
    "Op",
    "parse_mri",
    "ParsedMRI",
    "SeriesQuery",
    "SeriesResult",
    "VariableMap",
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
    # RATE = "rate"  # TODO: Implement rate
    COUNT_UNIQUE = "count_unique"

    def __contains__(cls, item):
        try:
            AggregationFn(item)
            return True
        except ValueError:
            return False


class ArithmeticFn(Enum):
    """
    Valid arithmetic functions for metrics queries to be used with ``Function``.
    """

    PLUS = "plus"
    MINUS = "minus"
    MULTIPLY = "multiply"
    DIVIDE = "divide"

    def __contains__(cls, item):
        try:
            ArithmeticFn(item)
            return True
        except ValueError:
            return False


# Function name used for filtering.
FILTER = "filter"


@dataclass(frozen=True)
class MetricQueryScope:
    org_id: int
    project_ids: Sequence[int] = []


# Variables are currently supported only in tag value position. The only
# supported values are strings, therefore.
VariableMap = Mapping[str, str]


@dataclass(frozen=True)
class SeriesQuery:
    """
    A metrics query that resolves time series.
    """

    # The organization and projects to query metrics for.
    scope: MetricQueryScope
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
    # The interval in seconds for each of the data points in the returned timeseries.
    # Defaults to ``0``, which will infer an appropriate interval from the time range.
    interval: int = 0

    @classmethod
    def parse(cls, dsl: str, params: Optional[VariableMap] = None) -> "SeriesQuery":
        """
        Parses a metrics query from a string.
        """
        # TODO: Move this to a query builder, since we also need groups etc.
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


def parse_mri(mri: str) -> ParsedMRI:
    """
    Parse a formatted MRI into its components. Raises ``InvalidMetricsQuery`` if
    the MRI is malformed or invalid.
    """

    if parsed := _parse_mri(mri):
        return parsed

    raise InvalidMetricsQuery(f"Invalid MRI: `{mri}`")
