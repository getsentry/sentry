from collections import OrderedDict
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sentry.search.utils import parse_datetime_string
from sentry.sentry_metrics.querying.data.execution import QueryResult
from sentry.sentry_metrics.querying.data.utils import nan_to_none
from sentry.sentry_metrics.querying.errors import MetricsQueryExecutionError
from sentry.sentry_metrics.querying.types import GroupKey, ResultValue, Series, Total


@dataclass
class GroupValue:
    series: Series
    total: Total

    @classmethod
    def empty(cls) -> "GroupValue":
        return GroupValue(series=[], total=None)

    def add_series_entry(self, time: str, aggregate_value: ResultValue):
        self.series.append((time, self._transform_aggregate_value(aggregate_value)))

    def add_total(self, aggregate_value: ResultValue):
        self.total = self._transform_aggregate_value(aggregate_value)

    def _transform_aggregate_value(self, aggregate_value: ResultValue):
        # For now, we don't support the array return type, since the set of operations that the API can support
        # won't lead to multiple values in a single aggregate value. For this reason, we extract the first value
        # in case we get back an array of values, which can happen for multiple quantiles.
        if isinstance(aggregate_value, list):
            if aggregate_value:
                return aggregate_value[0]

            raise MetricsQueryExecutionError("Received an empty array as aggregate value")

        return aggregate_value


@dataclass
class QueryMeta:
    name: str
    type: str

    def __post_init__(self):
        self._transform_meta_type()

    def _transform_meta_type(self):
        # Since we don't support the array aggregate value, and we return the first element, we just return the type of
        # the values of the array.
        if self.type.startswith("Array("):
            self.type = self.type[6 : len(self.type) - 1]


def _build_intervals(start: datetime, end: datetime, interval: int) -> Sequence[datetime]:
    """
    Builds a list of all the intervals that are queried by the metrics layer.
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
    Computes a full series over the entire requested interval with None set where there are no data points.
    """
    full_series = [null_value] * num_intervals
    for time, value in series:
        time_seconds = parse_datetime_string(time).timestamp()
        index = int((time_seconds - start_seconds) / interval)
        full_series[index] = value

    return full_series


class QueryTransformer:
    def __init__(self, query_results: list[QueryResult]):
        self._query_results = query_results

        self._start: datetime | None = None
        self._end: datetime | None = None
        self._interval: int | None = None

    def _assert_transformation_preconditions(self) -> tuple[datetime, datetime, int]:
        assert self._start is not None and self._end is not None and self._interval is not None
        return self._start, self._end, self._interval

    def _build_intermediate_results(
        self,
    ) -> tuple[OrderedDict[GroupKey, OrderedDict[str, GroupValue]], list[QueryMeta]]:
        """
        Builds a tuple of intermediate groups and metadata which is used to efficiently transform the query results.
        """
        intermediate_groups: OrderedDict[GroupKey, OrderedDict[str, GroupValue]] = OrderedDict()
        intermediate_meta: list[QueryMeta] = []

        def _add_to_intermediate_groups(values, block):
            for value in values:
                # We compute a list containing all the group values.
                grouped_values = []
                for group_by in query_result.group_bys or ():
                    grouped_values.append((group_by, value.get(group_by)))

                group_metrics = intermediate_groups.setdefault(tuple(grouped_values), OrderedDict())
                group_value = group_metrics.setdefault(query_result.query_name, GroupValue.empty())

                block(value, group_value)

        for query_result in self._query_results:
            # All queries must have the same timerange, so under this assumption we take the first occurrence of each.
            if self._start is None:
                self._start = query_result.modified_start
            if self._end is None:
                self._end = query_result.modified_end
            if self._interval is None:
                self._interval = query_result.interval

            # We group the totals data first, since we want the order to be set by the totals.
            _add_to_intermediate_groups(
                query_result.totals,
                lambda value, group: group.add_total(value.get("aggregate_value")),
            )

            # We group the series data second, which will use the already ordered dictionary entries added by the
            # totals.
            _add_to_intermediate_groups(
                query_result.series,
                lambda value, group: group.add_series_entry(
                    value.get("time"), value.get("aggregate_value")
                ),
            )

            meta = query_result.meta
            for meta_item in meta:
                meta_name = meta_item["name"]
                meta_type = meta_item["type"]

                # The meta of each query, contains the metadata for each field in the result. In this case,
                # we want to map the aggregate value type to the actual query name, which is used from the outside to
                # recognize the query.
                name = query_result.query_name if meta_name == "aggregate_value" else meta_name
                intermediate_meta.append(QueryMeta(name=name, type=meta_type))

        return intermediate_groups, intermediate_meta

    def transform(self) -> Mapping[str, Any]:
        """
        Transforms the query results into the Sentry's API format.
        """
        # We first build intermediate results that we can work efficiently with.
        intermediate_groups, intermediate_meta = self._build_intermediate_results()

        # We assert that all the data we require for the transformation has been found during the building of
        # intermediate results.
        start, end, interval = self._assert_transformation_preconditions()

        # We build the intervals that we will return to the API user.
        intervals = _build_intervals(start, end, interval)

        # We build the translated groups given the intermediate groups.
        translated_groups = []
        for group_key, group_metrics in intermediate_groups.items():
            translated_serieses: dict[str, Sequence[ResultValue]] = {}
            translated_totals: dict[str, ResultValue] = {}
            for metric_name, metric_values in group_metrics.items():
                series = metric_values.series
                total = metric_values.total

                # We generate the full series with a default value of `null` in case no series data is returned.
                translated_serieses[metric_name] = _generate_full_series(
                    int(start.timestamp()), len(intervals), interval, series
                )
                # In case we get nan, we will cast it to None but this can be changed in case there is the need.
                translated_totals[metric_name] = nan_to_none(total)

            # The order of the keys is not deterministic in the nested dictionaries.
            inner_group = {
                "by": {name: value for name, value in group_key},
                "series": translated_serieses,
                "totals": translated_totals,
            }

            translated_groups.append(inner_group)

        # We build the translated meta given the intermediate meta.
        translated_meta = [{"name": meta.name, "type": meta.type} for meta in intermediate_meta]

        return {
            "intervals": intervals,
            "groups": translated_groups,
            "meta": translated_meta,
            "start": start,
            "end": end,
        }
