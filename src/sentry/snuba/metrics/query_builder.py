__all__ = (
    "QueryDefinition",
    "SnubaQueryBuilder",
    "SnubaResultConverter",
    "get_date_range",
    "get_intervals",
    "parse_field",
    "parse_query",
    "resolve_tags",
)

import math
from collections import OrderedDict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple, Union

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
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.fields import DERIVED_METRICS, DerivedMetric, metric_object_factory
from sentry.snuba.metrics.utils import (
    _OPERATIONS_PERCENTILES,
    ALLOWED_GROUPBY_COLUMNS,
    FIELD_REGEX,
    MAX_POINTS,
    OPERATIONS,
    TS_COL_GROUP,
    TS_COL_QUERY,
    DerivedMetricParseException,
    MetricDoesNotExistException,
    TimeRange,
)
from sentry.snuba.sessions_v2 import (  # TODO: unite metrics and sessions_v2
    ONE_DAY,
    AllowedResolution,
    InvalidField,
    finite_or_none,
)
from sentry.utils.dates import parse_stats_period, to_datetime, to_timestamp
from sentry.utils.snuba import parse_snuba_datetime


def parse_field(field: str) -> Tuple[Optional[str], str]:
    matches = FIELD_REGEX.match(field)
    try:
        if matches is None:
            raise TypeError
        operation = matches[1]
        metric_name = matches[2]
        if metric_name in DERIVED_METRICS and isinstance(
            DERIVED_METRICS[metric_name], DerivedMetric
        ):
            raise DerivedMetricParseException(
                f"Failed to parse {field}. No operations can be applied on this field as it is "
                f"already a derived metric with an aggregation applied to it."
            )
    except (IndexError, TypeError):
        if field in DERIVED_METRICS and isinstance(DERIVED_METRICS[field], DerivedMetric):
            # The isinstance check is there to foreshadow adding raw metric aliases
            return None, field
        raise InvalidField(
            f"Failed to parse '{field}'. Must be something like 'sum(my_metric)', or a supported "
            f"aggregate derived metric like `session.crash_free_rate"
        )
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
    # Todo(ahmed): Check against `session.status` that was decided not to be supported
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

        # Validates that time series limit will not exceed the snuba limit of 10,000
        self._validate_series_limit(query_params)

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

    def _validate_series_limit(self, query_params):
        if self.limit:
            if (self.end - self.start).total_seconds() / self.rollup * self.limit > MAX_POINTS:
                raise InvalidParams(
                    f"Requested interval of {query_params.get('interval', '1h')} with statsPeriod of "
                    f"{query_params.get('statsPeriod')} is too granular for a per_page of "
                    f"{self.limit} elements. Increase your interval, decrease your statsPeriod, "
                    f"or decrease your per_page parameter."
                )


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
            Condition(Column(TS_COL_QUERY), Op.GTE, query_definition.start),
            Condition(Column(TS_COL_QUERY), Op.LT, query_definition.end),
        ]
        filter_ = resolve_tags(query_definition.parsed_query)
        if filter_:
            where.extend(filter_)

        return where

    def _build_groupby(self, query_definition: QueryDefinition) -> List[Column]:
        # ToDo ensure we cannot add any other cols than tags and groupBy as columns
        return [
            Column(resolve_tag_key(field))
            if field not in ALLOWED_GROUPBY_COLUMNS
            else Column(field)
            for field in query_definition.groupby
        ]

    def _build_orderby(self, query_definition: QueryDefinition) -> Optional[List[OrderBy]]:
        if query_definition.orderby is None:
            return None
        (op, metric_name), direction = query_definition.orderby
        metric_field_obj = metric_object_factory(op, metric_name)
        return metric_field_obj.generate_orderby_clause(
            projects=self._projects, direction=direction
        )

    @staticmethod
    def _build_totals_and_series_queries(
        entity, select, where, groupby, orderby, limit, offset, rollup, intervals_len
    ):
        totals_query = Query(
            dataset=Dataset.Metrics.value,
            match=Entity(entity),
            groupby=groupby,
            select=select,
            where=where,
            limit=Limit(limit or MAX_POINTS),
            offset=Offset(offset or 0),
            granularity=Granularity(rollup),
            orderby=orderby,
        )
        series_query = totals_query.set_groupby(
            (totals_query.groupby or []) + [Column(TS_COL_GROUP)]
        )

        # In a series query, we also need to factor in the len of the intervals array
        series_limit = MAX_POINTS
        if limit:
            series_limit = limit * intervals_len
        series_query = series_query.set_limit(series_limit)

        return {"totals": totals_query, "series": series_query}

    def _build_queries(self, query_definition):
        metric_name_to_obj_dict = {}

        queries_by_entity = OrderedDict()
        for op, metric_name in query_definition.fields.values():
            metric_field_obj = metric_object_factory(op, metric_name)
            # `get_entity` is called the first, to fetch the entities of constituent metrics,
            # and validate especially in the case of SingularEntityDerivedMetric that it is
            # actually composed of metrics that belong to the same entity
            try:
                entity = metric_field_obj.get_entity(projects=self._projects)
            except MetricDoesNotExistException:
                # If we get here, it means that one or more of the constituent metrics for a
                # derived metric does not exist, and so no further attempts to query that derived
                # metric will be made, and the field value will be set to the default value in
                # the response
                continue

            if not entity:
                # ToDo(ahmed): When we get to an instance of a MetricFieldBase where entity is
                #  None, we know it is from a composite entity derived metric, and we need to
                #  traverse down the constituent metrics dependency tree until we get to instances
                #  of SingleEntityDerivedMetric, and add those to our queries so that we are able
                #  to generate the original CompositeEntityDerivedMetric later on as a result of
                #  a post query operation on the results of the constituent
                #  SingleEntityDerivedMetric instances
                continue

            if entity not in self._implemented_datasets:
                raise NotImplementedError(f"Dataset not yet implemented: {entity}")

            metric_name_to_obj_dict[(op, metric_name)] = metric_field_obj

            queries_by_entity.setdefault(entity, []).append((op, metric_name))

        where = self._build_where(query_definition)
        groupby = self._build_groupby(query_definition)

        queries_dict = {}
        for entity, fields in queries_by_entity.items():
            select = []
            metric_ids_set = set()
            for op, name in fields:
                metric_field_obj = metric_name_to_obj_dict[(op, name)]
                select += metric_field_obj.generate_select_statements(projects=self._projects)
                metric_ids_set |= metric_field_obj.generate_metric_ids()

            where_for_entity = [
                Condition(
                    Column("metric_id"),
                    Op.IN,
                    list(metric_ids_set),
                ),
            ]
            orderby = self._build_orderby(query_definition)

            queries_dict[entity] = self._build_totals_and_series_queries(
                entity=entity,
                select=select,
                where=where + where_for_entity,
                groupby=groupby,
                orderby=orderby,
                limit=query_definition.limit,
                offset=query_definition.offset,
                rollup=query_definition.rollup,
                intervals_len=len(list(get_intervals(query_definition))),
            )

        return queries_dict

    def get_snuba_queries(self):
        return self._queries


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

        self._timestamp_index = {timestamp: index for index, timestamp in enumerate(intervals)}

    def _parse_tag(self, tag_string: str) -> str:
        tag_key = int(tag_string.replace("tags[", "").replace("]", ""))
        return reverse_resolve(tag_key)

    def _extract_data(self, data, groups):
        tags = tuple(
            (key, data[key])
            for key in sorted(data.keys())
            if (key.startswith("tags[") or key in ALLOWED_GROUPBY_COLUMNS)
        )

        tag_data = groups.setdefault(
            tags,
            {"totals": {}, "series": {}},
        )

        bucketed_time = data.pop(TS_COL_GROUP, None)
        if bucketed_time is not None:
            bucketed_time = parse_snuba_datetime(bucketed_time)

        for op, metric_name in self._query_definition.fields.values():
            key = f"{op}({metric_name})" if op else metric_name

            default_null_value = metric_object_factory(
                op, metric_name
            ).generate_default_null_values()

            try:
                value = data[key]
            except KeyError:
                # This could occur when we have derived metrics that are generated from post
                # query operations, and so don't have a direct mapping to the query results
                # or also from raw_metrics that don't exist in clickhouse yet
                cleaned_value = default_null_value
            else:
                if op in _OPERATIONS_PERCENTILES:
                    value = value[0]
                cleaned_value = finite_or_none(value)

            if bucketed_time is None:
                # Only update the value, when either key does not exist or its a default
                if key not in tag_data["totals"] or tag_data["totals"][key] == default_null_value:
                    tag_data["totals"][key] = cleaned_value

            if bucketed_time is not None or tag_data["totals"][key] == default_null_value:
                empty_values = len(self._intervals) * [default_null_value]
                series = tag_data["series"].setdefault(key, empty_values)

                if bucketed_time is not None:
                    series_index = self._timestamp_index[bucketed_time]
                    if series[series_index] == default_null_value:
                        series[series_index] = cleaned_value

    def translate_results(self):
        groups = {}
        for entity, subresults in self._results.items():
            totals = subresults["totals"]["data"]
            for data in totals:
                self._extract_data(data, groups)

            if "series" in subresults:
                series = subresults["series"]["data"]
                for data in series:
                    self._extract_data(data, groups)

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
