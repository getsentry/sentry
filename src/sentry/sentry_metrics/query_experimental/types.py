"""
Types to construct a metrics query request.
"""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum, EnumMeta
from typing import Any, Dict, FrozenSet, Iterable, Mapping, Optional, Sequence, Tuple

from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.expressions import Expression
from snuba_sdk.function import Function

from sentry.snuba.metrics.naming_layer import ParsedMRI
from sentry.snuba.metrics.naming_layer import parse_mri as _parse_mri
from sentry.utils.cache import memoize

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


class IndexableEnumMeta(EnumMeta):
    def __contains__(cls, item: Any):
        """
        Allow checking if a value is valid for an enum using ``in``.
        """

        try:
            cls(item)
            return True
        except ValueError:
            return False


class AggregationFn(Enum, metaclass=IndexableEnumMeta):
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


class ArithmeticFn(Enum, metaclass=IndexableEnumMeta):
    """
    Valid arithmetic functions for metrics queries to be used with ``Function``.
    """

    PLUS = "plus"
    MINUS = "minus"
    MULTIPLY = "multiply"
    DIVIDE = "divide"


# Function name used for filtering.
FILTER = "filter"


class InvalidMetricsQuery(Exception):
    """
    Raised during validation or execution when a metrics query is invalid.
    """

    pass


@dataclass(frozen=True)
class MetricQueryScope:
    org_id: int
    project_ids: Sequence[int]


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

    def __hash__(self):
        return hash(self._id)

    def __eq__(self, other):
        return self._id == other._id

    @memoize
    def _id(self):
        from uuid import uuid4

        return uuid4()


GroupKey = FrozenSet[Tuple[str, str]]
SeriesMap = Mapping[int, Mapping[datetime, float]]


@dataclass(frozen=True)
class SeriesResult:
    """
    A result of a metrics query.

    :param tags: Tag values for all tags in the result set.
    :param intervals: An ordered list of timestamps for data points in the
        result set. Some series may not contain data at every timestamp.
    :param groups: A list of series for each tag group in the result set. The
        order of series correspond to the expressions in the query.
    """

    tags: Mapping[str, Sequence[str]]
    intervals: Sequence[datetime]
    groups: Mapping[GroupKey, SeriesMap]
    # TODO: Better way to identify expressions?
    # TODO: Start / end? -> add query?
    # TODO: Meta data?

    def iter_groups(self) -> Iterable[Dict[str, str]]:
        """
        Iterate over the groups in this result.

        For queries without groups this will yield a single empty group.
        """

        for key in self.groups.keys():
            yield dict(key)

    def iter_series(
        self,
        expression: Optional[int] = None,
        tags: Optional[Mapping[str, str]] = None,
    ) -> Iterable[Tuple[datetime, Optional[float]]]:
        """
        Iterate over intervals and data points of a series in this result.
        Missing data points are represented as ``None``.

        :param expression: The index of the query's expression to iterate over.
            Must be provided if there is more than one expression.
        :param group_key: The tag set of the series to iterate over. Must be
            provided if there is more than one group.
        """

        if tags is None and (len(self.groups) > 1 or frozenset() not in self.groups is None):
            raise ValueError("Must provide group key")

        key: GroupKey = frozenset(tags.items()) if tags else frozenset()
        series = self.groups.get(key, {})
        if expression is None and len(series) > 1:
            raise ValueError("Must provide expression index")

        ts_map = series.get(expression or 0)
        if ts_map is None:
            return

        for interval in self.intervals:
            yield interval, ts_map.get(interval)

    def iter_values(
        self,
        expression: Optional[int] = None,
        tags: Optional[Mapping[str, str]] = None,
    ) -> Iterable[Optional[float]]:
        """
        Iterate over data points of a series in this result. Missing data points
        are represented as ``None``.

        :param expression: The index of the query's expression to iterate over.
            Must be provided if there is more than one expression.
        :param group_key: The tag set of the series to iterate over. Must be
            provided if there is more than one group.
        """

        for _, value in self.iter_series(expression, tags):
            yield value

    def to_dict(self) -> Dict:
        """
        Convert this result to a plain dictionary suitable for API output.
        """

        return {
            "intervals": list(self.intervals),
            "groups": [self._serialize_group(key, series) for key, series in self.groups.items()],
        }

    def _serialize_group(self, group_key: GroupKey, series: Mapping[int, Mapping[datetime, float]]):
        serialized = [[ts_map.get(ts) for ts in self.intervals] for ts_map in series.values()]
        return {"by": group_key, "series": serialized}


def parse_mri(mri: str) -> ParsedMRI:
    """
    Parse a formatted MRI into its components. Raises ``InvalidMetricsQuery`` if
    the MRI is malformed or invalid.
    """

    if parsed := _parse_mri(mri):
        return parsed

    raise InvalidMetricsQuery(f"Invalid MRI: `{mri}`")
