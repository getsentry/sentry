from collections import OrderedDict
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, cast

from sentry.search.utils import parse_datetime_string
from sentry.sentry_metrics.querying.data.execution import QueryResult
from sentry.sentry_metrics.querying.data.transformation.base import QueryResultsTransformer
from sentry.sentry_metrics.querying.data.utils import undefined_value_to_none
from sentry.sentry_metrics.querying.errors import MetricsQueryExecutionError
from sentry.sentry_metrics.querying.types import GroupKey, ResultValue, Series, Totals


@dataclass
class GroupValue:
    """
    Represents a single group of a query.

    Attributes:
        series: The timeseries data associated with the group. Each entry in the timeseries is characterized by the time
            and the aggregate value.
        totals: The totals data associated with the group. Totals represent just a single scalar value.
    """

    series: Series
    totals: Totals

    @classmethod
    def empty(cls) -> "GroupValue":
        return GroupValue(series=[], totals=None)

    def add_series_entry(self, time: str, aggregate_value: ResultValue):
        self.series.append((time, self._transform_aggregate_value(aggregate_value)))

    def add_totals(self, aggregate_value: ResultValue):
        self.totals = self._transform_aggregate_value(aggregate_value)

    def _transform_aggregate_value(self, aggregate_value: ResultValue) -> ResultValue:
        """
        Transforms a list aggregate value into a scalar aggregate value.

        The reason for this transformation is that we don't support the array return type, since the set of
        operations that the API can support won't lead to multiple values in a single aggregate value.

        Returns:
             The transformed aggregate value.
        """
        if isinstance(aggregate_value, list):
            if aggregate_value:
                return aggregate_value[0]

            raise MetricsQueryExecutionError("Received an empty array as aggregate value")

        return aggregate_value


@dataclass
class QueryMeta:
    """
    Represents the metadata of the query.

    Attributes:
        meta: The arbitrary metadata that can be added to a query.
    """

    meta: dict[str, Any]

    def __init__(self, **kwargs):
        self.meta = kwargs
        self._transform_meta()

    def _transform_meta(self):
        """
        Transforms the medata of the query after initialization.

        This transformation is required since specific keys of metadata need to be modified before returning them to
        the user.
        """
        # Since we don't support the array aggregate value, and we return the first element, we just return the type of
        # the values of the array.
        if type := self.meta.get("type"):
            if type.startswith("Array("):
                self.meta["type"] = type[6 : len(type) - 1]


def _build_intervals(start: datetime, end: datetime, interval: int) -> Sequence[datetime]:
    """
    Builds a list of datetime objects given two time bounds and the size of the interval between each element.

    Returns:
        A list of datetime objects representing all the intervals of the query.
    """
    start_seconds = start.timestamp()
    end_seconds = end.timestamp()

    current_time = start_seconds
    intervals = []
    while current_time < end_seconds:
        intervals.append(datetime.fromtimestamp(current_time, timezone.utc))
        current_time = current_time + interval

    return intervals


def _generate_full_series(
    start_seconds: int,
    num_intervals: int,
    interval: int,
    series: Series,
    null_value: ResultValue = None,
) -> Sequence[ResultValue]:
    """
    Generates a full timeseries of values given the size of the timeseries.

    Each value of the timeseries is initialized with a default value and eventually replaced with the actual value of
    the supplied timeseries if available.

    Returns:
        A full timeseries containing all the intervals that are expected.
    """
    full_series = [null_value] * num_intervals
    for time, value in series:
        time_seconds = parse_datetime_string(time).timestamp()
        index = int((time_seconds - start_seconds) / interval)
        full_series[index] = undefined_value_to_none(value)

    return full_series


class MetricsAPIQueryResultsTransformer(QueryResultsTransformer[Mapping[str, Any]]):
    """
    Represents a transformer that converts the query results into a format which is known by the Metrics API.
    """

    def __init__(self) -> None:
        self._start: datetime | None = None
        self._end: datetime | None = None
        self._interval: int | None = None

    def _assert_transformation_preconditions(self) -> tuple[datetime, datetime, int | None]:
        assert self._start is not None and self._end is not None
        return self._start, self._end, self._interval

    def _build_intermediate_results(
        self, query_results: list[QueryResult]
    ) -> tuple[list[OrderedDict[GroupKey, GroupValue]], list[list[QueryMeta]]]:
        """
        Builds a tuple of intermediate groups and metadata which is used to efficiently transform the query results.

        Returns:
            A tuple of intermediate groups and metadata.
        """
        queries_groups: list[OrderedDict[GroupKey, GroupValue]] = []
        queries_meta: list[list[QueryMeta]] = []

        def _add_to_query_groups(
            rows: Sequence[Mapping[str, Any]],
            group_bys: list[str],
            query_groups: OrderedDict[GroupKey, GroupValue],
            add_to_group: Callable[[Mapping[str, Any], GroupValue], None],
        ) -> None:
            if not rows:
                query_groups.setdefault(tuple(), GroupValue.empty())
                return

            for row in rows:
                grouped_values = []
                for group_by in group_bys:
                    # We can cast the group by to string because we know that tags must be strings.
                    grouped_values.append((group_by, cast(str, row.get(group_by))))

                group_value = query_groups.setdefault(tuple(grouped_values), GroupValue.empty())
                add_to_group(row, group_value)
            return

        for query_result in query_results:
            # All queries must have the same timerange, so under this assumption we take the first occurrence of each.
            if self._start is None:
                self._start = query_result.modified_start
            if self._end is None:
                self._end = query_result.modified_end
            if self._interval is None:
                self._interval = query_result.interval

            query_groups: OrderedDict[GroupKey, GroupValue] = OrderedDict()

            # We obtain the group bys of the query.
            group_bys = query_result.group_bys

            # We group the totals data first, since we want the order to be set by the totals.
            _add_to_query_groups(
                query_result.totals,
                group_bys,
                query_groups,
                lambda value, group: group.add_totals(value.get("aggregate_value")),
            )

            if query_result.series_query is not None:
                # We group the series data second, which will use the already ordered dictionary entries added by the
                # totals.
                _add_to_query_groups(
                    query_result.series,
                    group_bys,
                    query_groups,
                    lambda value, group: group.add_series_entry(
                        cast(str, value.get("time")), value.get("aggregate_value")
                    ),
                )

            query_meta = []

            for meta_item in query_result.meta:
                meta_name = meta_item["name"]
                meta_type = meta_item["type"]
                query_meta.append(QueryMeta(name=meta_name, type=meta_type))

            # We add additional metadata from the query themselves to make the API more transparent.
            query_meta.append(
                QueryMeta(
                    group_bys=group_bys,
                    order=query_result.order.value if query_result.order else None,
                    limit=query_result.limit,
                    has_more=query_result.has_more,
                    unit_family=(
                        query_result.unit_family.value if query_result.unit_family else None
                    ),
                    unit=query_result.unit,
                    scaling_factor=query_result.scaling_factor,
                )
            )

            queries_groups.append(query_groups)
            queries_meta.append(query_meta)

        return queries_groups, queries_meta

    def transform(self, query_results: list[QueryResult]) -> Mapping[str, Any]:
        """
        Transforms the query results into the Metrics API format.

        Returns:
            A mapping containing the data transformed in the correct format.
        """
        base_result: dict[str, Any] = {
            "data": [],
            "meta": [],
            "start": None,
            "end": None,
            "intervals": [],
        }

        if not query_results:
            return base_result

        # We first build intermediate results that we can work efficiently with.
        queries_groups, queries_meta = self._build_intermediate_results(query_results)

        # We assert that all the data we require for the transformation has been found during the building of
        # intermediate results.
        start, end, interval = self._assert_transformation_preconditions()

        intervals = None
        if interval is not None:
            # We build the intervals that we will return to the API user.
            intervals = _build_intervals(start, end, interval)

        # We build the transformed groups given the intermediate groups.
        transformed_queries_groups = []
        for query_groups in queries_groups:
            translated_query_groups = []
            for group_key, group_value in query_groups.items():
                base_group: dict[str, Any] = {
                    "by": {name: value for name, value in group_key},
                    "totals": undefined_value_to_none(group_value.totals),
                }

                if intervals is not None and interval is not None:
                    base_group["series"] = _generate_full_series(
                        int(start.timestamp()), len(intervals), interval, group_value.series
                    )

                translated_query_groups.append(base_group)

            transformed_queries_groups.append(translated_query_groups)

        # We build the transformed meta given the intermediate meta.
        transformed_queries_meta = []
        for query_meta in queries_meta:
            transformed_queries_meta.append([meta.meta for meta in query_meta])

        base_result["data"] = transformed_queries_groups
        base_result["meta"] = transformed_queries_meta
        base_result["start"] = start
        base_result["end"] = end
        if intervals is not None:
            base_result["intervals"] = intervals

        return base_result
