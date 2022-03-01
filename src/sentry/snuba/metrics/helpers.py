__all__ = (
    "ALLOWED_GROUPBY_COLUMNS",
    "AVAILABLE_OPERATIONS",
    "FIELD_REGEX",
    "MAX_POINTS",
    "METRIC_TYPE_TO_ENTITY",
    "MetricMeta",
    "MetricMetaWithTagKeys",
    "MetricOperation",
    "MetricType",
    "MetricUnit",
    "OPERATIONS",
    "QueryDefinition",
    "SnubaQueryBuilder",
    "SnubaResultConverter",
    "TAG_REGEX",
    "TS_COL_GROUP",
    "TS_COL_QUERY",
    "Tag",
    "TagValue",
    "TimeRange",
    "get_date_range",
    "get_intervals",
    "parse_field",
    "parse_query",
    "resolve_tags",
)

import math
import re
from collections import OrderedDict
from datetime import datetime, timedelta
from typing import (
    Any,
    Collection,
    Dict,
    List,
    Literal,
    Mapping,
    Optional,
    Protocol,
    Sequence,
    Tuple,
    TypedDict,
    Union,
)

from snuba_sdk import Column, Condition, Entity, Function, Granularity, Limit, Offset, Op, Query
from snuba_sdk.conditions import BooleanCondition
from snuba_sdk.orderby import Direction, OrderBy

from sentry.api.utils import InvalidParams, get_date_range_from_params
from sentry.exceptions import InvalidSearchQuery
from sentry.models import Project
from sentry.search.events.builder import UnresolvedQuery
from sentry.sentry_metrics.utils import (
    resolve_tag_key,
    resolve_weak,
    reverse_resolve,
    reverse_resolve_weak,
)
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.sessions_v2 import (  # TODO: unite metrics and sessions_v2
    ONE_DAY,
    AllowedResolution,
    InvalidField,
    finite_or_none,
)
from sentry.utils.dates import parse_stats_period, to_datetime, to_timestamp
from sentry.utils.snuba import parse_snuba_datetime

FIELD_REGEX = re.compile(r"^(\w+)\(((\w|\.|_)+)\)$")
TAG_REGEX = re.compile(r"^(\w|\.|_)+$")

_OPERATIONS_PERCENTILES = (
    "p50",
    "p75",
    "p90",
    "p95",
    "p99",
)

OPERATIONS = (
    "avg",
    "count_unique",
    "count",
    "max",
    "sum",
) + _OPERATIONS_PERCENTILES

#: Max number of data points per time series:
MAX_POINTS = 10000


TS_COL_QUERY = "timestamp"
TS_COL_GROUP = "bucketed_time"


def parse_field(field: str) -> Tuple[str, str]:
    matches = FIELD_REGEX.match(field)
    try:
        if matches is None:
            raise TypeError
        operation = matches[1]
        metric_name = matches[2]
    except (IndexError, TypeError):
        raise InvalidField(f"Failed to parse '{field}'. Must be something like 'sum(my_metric)'.")
    else:
        if operation not in OPERATIONS:

            raise InvalidField(
                f"Invalid operation '{operation}'. Must be one of {', '.join(OPERATIONS)}"
            )

        return operation, metric_name


def resolve_tags(input_: Any) -> Any:
    """Translate tags in snuba condition

    This assumes that all strings are either tag names or tag values, so do not
    pass Column("metric_id") or Column("project_id") into this function.

    """
    if isinstance(input_, list):
        return [resolve_tags(item) for item in input_]
    if isinstance(input_, Function):
        if input_.function == "ifNull":
            # This was wrapped automatically by QueryBuilder, remove wrapper
            return resolve_tags(input_.parameters[0])
        return Function(
            function=input_.function,
            parameters=input_.parameters and [resolve_tags(item) for item in input_.parameters],
        )
    if isinstance(input_, Condition):
        return Condition(lhs=resolve_tags(input_.lhs), op=input_.op, rhs=resolve_tags(input_.rhs))
    if isinstance(input_, BooleanCondition):
        return input_.__class__(conditions=[resolve_tags(item) for item in input_.conditions])
    if isinstance(input_, Column):
        # HACK: Some tags already take the form "tags[...]" in discover, take that into account:
        if input_.subscriptable == "tags":
            name = input_.key
        else:
            name = input_.name
        return Column(name=resolve_tag_key(name))
    if isinstance(input_, str):
        return resolve_weak(input_)

    return input_


def parse_query(query_string: str) -> Sequence[Condition]:
    """Parse given filter query into a list of snuba conditions"""
    # HACK: Parse a sessions query, validate / transform afterwards.
    # We will want to write our own grammar + interpreter for this later.
    try:
        query_builder = UnresolvedQuery(
            Dataset.Sessions,
            params={
                "project_id": 0,
            },
        )
        where, _ = query_builder.resolve_conditions(query_string, use_aggregate_conditions=True)
    except InvalidSearchQuery as e:
        raise InvalidParams(f"Failed to parse query: {e}")

    return where


class QueryDefinition:
    """
    This is the definition of the query the user wants to execute.
    This is constructed out of the request params, and also contains a list of
    `fields` and `groupby` definitions as [`ColumnDefinition`] objects.

    Adapted from [`sentry.snuba.sessions_v2`].

    """

    def __init__(self, query_params, paginator_kwargs: Optional[Dict] = None):
        paginator_kwargs = paginator_kwargs or {}

        self.query = query_params.get("query", "")
        self.parsed_query = parse_query(self.query) if self.query else None
        raw_fields = query_params.getlist("field", [])
        self.groupby = query_params.getlist("groupBy", [])

        if len(raw_fields) == 0:
            raise InvalidField('Request is missing a "field"')

        self.fields = {key: parse_field(key) for key in raw_fields}

        self.orderby = self._parse_orderby(query_params)
        self.limit = self._parse_limit(query_params, paginator_kwargs)
        self.offset = self._parse_offset(query_params, paginator_kwargs)

        start, end, rollup = get_date_range(query_params)
        self.rollup = rollup
        self.start = start
        self.end = end

    def _parse_orderby(self, query_params):
        orderby = query_params.getlist("orderBy", [])
        if not orderby:
            return None
        elif len(orderby) > 1:
            raise InvalidParams("Only one 'orderBy' is supported")

        orderby = orderby[0]
        direction = Direction.ASC
        if orderby[0] == "-":
            orderby = orderby[1:]
            direction = Direction.DESC
        try:
            op, metric_name = self.fields[orderby]
        except KeyError:
            # orderBy one of the group by fields may be supported in the future
            raise InvalidParams("'orderBy' must be one of the provided 'fields'")

        return (op, metric_name), direction

    def _parse_limit(self, query_params, paginator_kwargs):
        if self.orderby:
            return paginator_kwargs.get("limit")
        else:
            per_page = query_params.get("per_page")
            if per_page is not None:
                # If order by is not None, it means we will have a `series` query which cannot be
                # paginated, and passing a `per_page` url param to paginate the results is not
                # possible
                raise InvalidParams("'per_page' is only supported in combination with 'orderBy'")
            return None

    def _parse_offset(self, query_params, paginator_kwargs):
        if self.orderby:
            return paginator_kwargs.get("offset")
        else:
            cursor = query_params.get("cursor")
            if cursor is not None:
                # If order by is not None, it means we will have a `series` query which cannot be
                # paginated, and passing a `per_page` url param to paginate the results is not
                # possible
                raise InvalidParams("'cursor' is only supported in combination with 'orderBy'")
            return None


class TimeRange(Protocol):
    start: datetime
    end: datetime
    rollup: int


def get_intervals(query: TimeRange):
    start = query.start
    end = query.end
    delta = timedelta(seconds=query.rollup)
    while start < end:
        yield start
        start += delta


def get_date_range(params: Mapping) -> Tuple[datetime, datetime, int]:
    """Get start, end, rollup for the given parameters.

    Apply a similar logic as `sessions_v2.get_constrained_date_range`,
    but with fewer constraints. More constraints may be added in the future.

    Note that this function returns a right-exclusive date range [start, end),
    contrary to the one used in sessions_v2.

    """
    interval = parse_stats_period(params.get("interval", "1h"))
    interval = int(3600 if interval is None else interval.total_seconds())

    # hard code min. allowed resolution to 10 seconds
    allowed_resolution = AllowedResolution.ten_seconds

    smallest_interval, interval_str = allowed_resolution.value
    if interval % smallest_interval != 0 or interval < smallest_interval:
        raise InvalidParams(
            f"The interval has to be a multiple of the minimum interval of {interval_str}."
        )

    if ONE_DAY % interval != 0:
        raise InvalidParams("The interval should divide one day without a remainder.")

    start, end = get_date_range_from_params(params)

    date_range = end - start

    date_range = timedelta(seconds=int(interval * math.ceil(date_range.total_seconds() / interval)))

    if date_range.total_seconds() / interval > MAX_POINTS:
        raise InvalidParams(
            "Your interval and date range would create too many results. "
            "Use a larger interval, or a smaller date range."
        )

    end_ts = int(interval * math.ceil(to_timestamp(end) / interval))
    end = to_datetime(end_ts)
    start = end - date_range

    # NOTE: The sessions_v2 implementation cuts the `end` time to now + 1 minute
    # if `end` is in the future. This allows for better real time results when
    # caching is enabled on the snuba queries. Removed here for simplicity,
    # but we might want to reconsider once caching becomes an issue for metrics.

    return start, end, interval


#: The type of metric, which determines the snuba entity to query
MetricType = Literal["counter", "set", "distribution"]

#: A function that can be applied to a metric
MetricOperation = Literal["avg", "count", "max", "min", "p50", "p75", "p90", "p95", "p99"]

MetricUnit = Literal["seconds"]


METRIC_TYPE_TO_ENTITY: Mapping[MetricType, EntityKey] = {
    "counter": EntityKey.MetricsCounters,
    "set": EntityKey.MetricsSets,
    "distribution": EntityKey.MetricsDistributions,
}


class MetricMeta(TypedDict):
    name: str
    type: MetricType
    operations: Collection[MetricOperation]
    unit: Optional[MetricUnit]


class Tag(TypedDict):
    key: str  # Called key here to be consistent with JS type


class TagValue(TypedDict):
    key: str
    value: str


class MetricMetaWithTagKeys(MetricMeta):
    tags: Sequence[Tag]


# Map requested op name to the corresponding Snuba function
_OP_TO_SNUBA_FUNCTION = {
    "metrics_counters": {"sum": "sum"},
    "metrics_distributions": {
        "avg": "avg",
        "count": "count",
        "max": "max",
        "min": "min",
        # TODO: Would be nice to use `quantile(0.50)` (singular) here, but snuba responds with an error
        "p50": "quantiles(0.50)",
        "p75": "quantiles(0.75)",
        "p90": "quantiles(0.90)",
        "p95": "quantiles(0.95)",
        "p99": "quantiles(0.99)",
    },
    "metrics_sets": {"count_unique": "uniq"},
}

AVAILABLE_OPERATIONS = {
    type_: sorted(mapping.keys()) for type_, mapping in _OP_TO_SNUBA_FUNCTION.items()
}
OPERATIONS_TO_ENTITY = {
    op: entity for entity, operations in AVAILABLE_OPERATIONS.items() for op in operations
}
ALLOWED_GROUPBY_COLUMNS = ("project_id",)


class SnubaQueryBuilder:

    #: Datasets actually implemented in snuba:
    _implemented_datasets = {
        "metrics_counters",
        "metrics_distributions",
        "metrics_sets",
    }

    def __init__(self, projects: Sequence[Project], query_definition: QueryDefinition):
        self._projects = projects
        self._queries = self._build_queries(query_definition)

    def _build_where(
        self, query_definition: QueryDefinition
    ) -> List[Union[BooleanCondition, Condition]]:
        assert self._projects
        org_id = self._projects[0].organization_id
        where: List[Union[BooleanCondition, Condition]] = [
            Condition(Column("org_id"), Op.EQ, org_id),
            Condition(Column("project_id"), Op.IN, [p.id for p in self._projects]),
            Condition(
                Column("metric_id"),
                Op.IN,
                [resolve_weak(name) for _, name in query_definition.fields.values()],
            ),
            Condition(Column(TS_COL_QUERY), Op.GTE, query_definition.start),
            Condition(Column(TS_COL_QUERY), Op.LT, query_definition.end),
        ]
        filter_ = resolve_tags(query_definition.parsed_query)
        if filter_:
            where.extend(filter_)

        return where

    def _build_groupby(self, query_definition: QueryDefinition) -> List[Column]:
        return [Column("metric_id")] + [
            Column(resolve_tag_key(field))
            if field not in ALLOWED_GROUPBY_COLUMNS
            else Column(field)
            for field in query_definition.groupby
        ]

    def _build_orderby(
        self, query_definition: QueryDefinition, entity: str
    ) -> Optional[List[OrderBy]]:
        if query_definition.orderby is None:
            return None
        (op, _), direction = query_definition.orderby

        return [OrderBy(Column(op), direction)]

    def _build_queries(self, query_definition):
        queries_by_entity = OrderedDict()
        for op, metric_name in query_definition.fields.values():
            entity = OPERATIONS_TO_ENTITY[op]

            if entity not in self._implemented_datasets:
                raise NotImplementedError(f"Dataset not yet implemented: {entity}")

            queries_by_entity.setdefault(entity, []).append((op, metric_name))

        where = self._build_where(query_definition)
        groupby = self._build_groupby(query_definition)

        return {
            entity: self._build_queries_for_entity(query_definition, entity, fields, where, groupby)
            for entity, fields in queries_by_entity.items()
        }

    @staticmethod
    def _build_select(entity, fields):
        for op, _ in fields:
            snuba_function = _OP_TO_SNUBA_FUNCTION[entity][op]
            yield Function(snuba_function, [Column("value")], alias=op)

    def _build_queries_for_entity(self, query_definition, entity, fields, where, groupby):
        totals_query = Query(
            dataset=Dataset.Metrics.value,
            match=Entity(entity),
            groupby=groupby,
            select=list(self._build_select(entity, fields)),
            where=where,
            limit=Limit(query_definition.limit or MAX_POINTS),
            offset=Offset(query_definition.offset or 0),
            granularity=Granularity(query_definition.rollup),
            orderby=self._build_orderby(query_definition, entity),
        )

        series_query = totals_query.set_groupby(
            (totals_query.groupby or []) + [Column(TS_COL_GROUP)]
        )

        # In a series query, we also need to factor in the len of the intervals array
        series_limit = MAX_POINTS
        if query_definition.limit:
            series_limit = query_definition.limit * len(list(get_intervals(query_definition)))
        series_query = series_query.set_limit(series_limit)

        return {
            "totals": totals_query,
            "series": series_query,
        }

    def get_snuba_queries(self):
        return self._queries


_DEFAULT_AGGREGATES = {
    "avg": None,
    "count_unique": 0,
    "count": 0,
    "max": None,
    "p50": None,
    "p75": None,
    "p90": None,
    "p95": None,
    "p99": None,
    "sum": 0,
}


class SnubaResultConverter:
    """Interpret a Snuba result and convert it to API format"""

    def __init__(
        self,
        organization_id: int,
        query_definition: QueryDefinition,
        intervals: List[datetime],
        results,
    ):
        self._organization_id = organization_id
        self._query_definition = query_definition
        self._intervals = intervals
        self._results = results

        self._ops_by_metric = ops_by_metric = {}
        for op, metric in query_definition.fields.values():
            ops_by_metric.setdefault(metric, []).append(op)

        self._timestamp_index = {timestamp: index for index, timestamp in enumerate(intervals)}

    def _parse_tag(self, tag_string: str) -> str:
        tag_key = int(tag_string.replace("tags[", "").replace("]", ""))
        return reverse_resolve(tag_key)

    def _extract_data(self, entity, data, groups):
        tags = tuple(
            (key, data[key])
            for key in sorted(data.keys())
            if (key.startswith("tags[") or key in ALLOWED_GROUPBY_COLUMNS)
        )

        metric_name = reverse_resolve(data["metric_id"])
        ops = self._ops_by_metric[metric_name]

        tag_data = groups.setdefault(
            tags,
            {
                "totals": {},
            },
        )

        timestamp = data.pop(TS_COL_GROUP, None)
        if timestamp is not None:
            timestamp = parse_snuba_datetime(timestamp)

        for op in ops:
            key = f"{op}({metric_name})"

            value = data[op]
            if op in _OPERATIONS_PERCENTILES:
                value = value[0]

            # If this is time series data, add it to the appropriate series.
            # Else, add to totals
            if timestamp is None:
                tag_data["totals"][key] = finite_or_none(value)
            else:
                series = tag_data.setdefault("series", {}).setdefault(
                    key, len(self._intervals) * [_DEFAULT_AGGREGATES[op]]
                )
                series_index = self._timestamp_index[timestamp]
                series[series_index] = finite_or_none(value)

    def translate_results(self):
        groups = {}

        for entity, subresults in self._results.items():
            totals = subresults["totals"]["data"]
            for data in totals:
                self._extract_data(entity, data, groups)

            if "series" in subresults:
                series = subresults["series"]["data"]
                for data in series:
                    self._extract_data(entity, data, groups)

        groups = [
            dict(
                by=dict(
                    (self._parse_tag(key), reverse_resolve_weak(value))
                    if key not in ALLOWED_GROUPBY_COLUMNS
                    else (key, value)
                    for key, value in tags
                ),
                **data,
            )
            for tags, data in groups.items()
        ]

        return groups
