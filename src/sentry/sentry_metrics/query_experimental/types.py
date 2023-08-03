"""
Types to construct a metrics query request.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum, EnumMeta
from typing import (
    Any,
    Dict,
    FrozenSet,
    Iterable,
    Literal,
    Mapping,
    Optional,
    Sequence,
    Tuple,
    Union,
)

from snuba_sdk.column import Column
from snuba_sdk.expressions import Expression
from snuba_sdk.function import Function

from sentry.snuba.metrics.naming_layer import ParsedMRI
from sentry.snuba.metrics.naming_layer import parse_mri as _parse_mri
from sentry.utils.cache import memoize

__all__ = (
    "AggregationFn",
    "ArithmeticFn",
    "ConditionFn",
    "Expression",
    "Filter",
    "Function",
    "InvalidMetricsQuery",
    "MetricScope",
    "TimeRange",
    "parse_mri",
    "ParsedMRI",
    "SeriesQuery",
    "SeriesResult",
    "SeriesRollup",
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

    Example::

        Function(AggregationFn.AVG.value, [
            MetricName(MRI),
        ])
    """

    # Sum all values in a counter metric.
    SUM = "sum"
    # Compute the rate per time interval of a counter or distribution metric.
    # This operates the same as ``sum`` on counters and ``count`` on
    # distributions, but takes the time interval into account.
    # RATE = "rate"  # TODO: Implement rate
    # Count occurrences of a distribution metric, irrespective of value.
    COUNT = "count"
    # Compute the average of a distribution metric.
    AVG = "avg"
    # Obtain the maximum value of a distribution metric.
    MAX = "max"
    # Obtain the minimum value of a distribution metric.
    MIN = "min"
    # Compute the median of a distribution metric.
    P50 = "p50"
    # Compute the 75th percentile of a distribution metric.
    P75 = "p75"
    # Compute the 95th percentile of a distribution metric.
    P95 = "p95"
    # Compute the 99th percentile of a distribution metric.
    P99 = "p99"
    # Compute the number of unique values in a set metric.
    COUNT_UNIQUE = "count_unique"


class ArithmeticFn(Enum, metaclass=IndexableEnumMeta):
    """
    Valid arithmetic functions for metrics queries to be used with ``Function``.

    Example::

        Function("divide", [
            Function("sum", [MetricName(FAILURES_MRI)]),
            Function("sum", [MetricName(TOTALS_MRI)]),
        ])
    """

    PLUS = "plus"
    MINUS = "minus"
    MULTIPLY = "multiply"
    DIVIDE = "divide"


@dataclass(frozen=True)
class Filter(Function):
    """
    A built-in function that filters a metric or aggregate by a set of tag
    conditions.

    The first parameter is the metric or aggregate to filter. All other
    parameters are tag conditions functions to filter by. See ``ConditionFn``
    for valid conditions. If multiple conditions are provided, all conditions
    must be met for a bucket to be included in the result.

    Example::

        # Apply filter on a metric and aggregate outside.
        Filter([
            MetricName(MY_MRI), Function("equals", [Tag("transaction"), "b"]),
        ])

        # Apply filter on an aggregate. Filter([
            Function("sum", [MetricName(MY_MRI)]), Function("equals",
            [Tag("transaction"), "b"]),
        ])

        # Multiple conditions are joined together Filter([
            Function("sum", [MetricName(MY_MRI)]), Function("equals",
            [Tag("transaction"), "b"]), Function("like", [Tag("release"),
            "1.*"]),
        ])
    """

    function: Literal["filter__builtin"] = field(init=False, default="filter__builtin")


class ConditionFn(Enum, metaclass=IndexableEnumMeta):
    """
    Valid filter conditions for metrics queries to be used with ``Function``.
    These can be placed only inside a ``Filter`` function.

    Example::

        Filter([
            MetricName(MY_MRI),
            Function("equals", [Tag("transaction"), "b"]),
        ])
    """

    EQ = "equals"
    NEQ = "notEquals"
    LIKE = "like"
    NOT_LIKE = "notLike"
    IN = "in"
    NOT_IN = "notIn"

    @property
    def value_type(self) -> Literal["scalar", "tuple", "none"]:
        """
        Return the type of value expected for this condition.
        """
        if self in (ConditionFn.IN, ConditionFn.NOT_IN):
            return "tuple"
        elif self in (ConditionFn.EQ, ConditionFn.NEQ, ConditionFn.LIKE, ConditionFn.NOT_LIKE):
            return "scalar"
        else:
            # NB: This is in case we add IS NULL or IS NOT NULL in the future.
            return "none"


@dataclass(frozen=True)
class Tag(Column):
    pass


@dataclass(frozen=True)
class MetricName(Column):
    pass


@dataclass(frozen=True)
class Variable(Column):
    pass


class InvalidMetricsQuery(Exception):
    """
    Raised during validation or execution when a metrics query is invalid.
    """

    pass


@dataclass(frozen=True)
class MetricScope:
    """
    Scoping information for metrics queries.
    """

    org_id: int  # TODO: Support cross-org queries
    project_ids: Sequence[int]


@dataclass(frozen=True)
class TimeRange:
    """
    A time range for a metrics query.

    :param start: The inclusive start of the time range to query.
    :param end: The exclusive end of the time range to query.
    """

    start: datetime
    end: datetime

    @classmethod
    def start_at(cls, start: datetime, days=0, hours=0, minutes=0, seconds=0) -> "TimeRange":
        """
        Create a metric range that starts at the specified time and ends after
        the specified duration.
        """
        delta = timedelta(days=days, hours=hours, minutes=minutes, seconds=seconds)
        return cls(start, start + delta)

    @classmethod
    def end_at(cls, end: datetime, days=0, hours=0, minutes=0, seconds=0) -> "TimeRange":
        """
        Create a metric range that ends at the specified time and goes back for
        the specified duration.
        """
        delta = timedelta(days=days, hours=hours, minutes=minutes, seconds=seconds)
        return cls(end - delta, end)

    @classmethod
    def since(cls, start: datetime) -> "TimeRange":
        """
        Create a metric range that starts at the specified time and ends now.
        """
        return cls(start, datetime.utcnow())

    @classmethod
    def last(cls, days=0, hours=0, minutes=0, seconds=0) -> "TimeRange":
        """
        Create a metric range that ends now and goes back for the specified
        duration.
        """
        return cls.end_at(datetime.utcnow(), days, hours, minutes, seconds)


@dataclass(frozen=True)
class SeriesRollup:
    """
    Configures how time series are rolled up for a metrics query.

    By default, time series are rolled up into intervals that adjust
    automatically based on the queried time range. This can be configured to use
    a fixed interval instead:

        SeriesRollup(3600)

    Additionally, the rollup can be configured to include totals:

        SeriesRollup(totals=True)

    If just totals are desired, set ``interval`` to ``None`` or use
    ``SeriesRollup.totals_only()``:

        SeriesRollup.totals_only()

    :param interval: The interval in seconds to roll up time series into. If
        ``"auto"``, the interval will be automatically determined based on the
        queried time range. Defaults to ``"auto"``.
    :param totals: Whether to include totals in the result. Defaults to False.
    """

    interval: Optional[Union[int, Literal["auto"]]] = "auto"
    totals: bool = False

    @classmethod
    def totals_only(cls) -> "SeriesRollup":
        """
        Create a rollup that only returns totals.
        """
        return cls(interval=None, totals=True)


VariableMap = Mapping[str, Expression]
Taggable = Union[Tag, Variable]


@dataclass(frozen=True)
class SeriesQuery:
    """
    A metrics query that resolves time series.

    :param scope: The organization and projects to query metrics for.
    :param range: The time range to query metrics for.
    :param expressions: Metric expressions to resolve.
    :param filters: A set of conditions to filter the time series specified by
        `expressions` by. This is a shorthand for wrapping every one of the
        expressions in the specified filters. Default is empty.
    :param groups: A set of tag names to group the time series specified by
        `expressions` by. Default is empty.
    :param rollup: The rollup configuration for the query. Default is
        automatically inferred intervals and no totals.

    Example::

        SeriesQuery(
            scope=MetricScope(org_id=1, project_ids=[1]),
            range=TimeRange.end_at(self.now, hours=12),
            expressions=[Function("avg", [MetricName("measurements.fcp")])],
            filters=[Function("equals", [Tag("transaction"), "xyz"])],
            groups=[Tag("environment")],
            rollup=SeriesRollup(3600),
        )
    """

    scope: MetricScope
    range: TimeRange
    expressions: Sequence[Expression]
    filters: Sequence[Function] = field(default_factory=list)
    groups: Sequence[Taggable] = field(default_factory=list)
    rollup: SeriesRollup = field(default_factory=SeriesRollup)

    def bind(self, **params: Expression) -> "SeriesQuery":
        """
        Bind the specified variables to this query.

        Raises ``InvalidMetricsQuery`` if a referenced variable is missing from
        the variable map.
        """
        from .variables import bind_variables

        return bind_variables(self, params)

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

    To iterate over the series in this result, use the :meth:`iter_series` or
    :meth:`iter_groups` methods.

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
    # TODO: Do we need start / end? -> add query?
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
