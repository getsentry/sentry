__all__ = (
    "QueryDefinition",
    "SnubaQueryBuilder",
    "SnubaResultConverter",
    "get_date_range",
    "parse_field",
    "parse_query",
    "resolve_tags",
)

from datetime import datetime, timedelta
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple, Union

from snuba_sdk import Column, Condition, Entity, Function, Granularity, Limit, Offset, Op, Or, Query
from snuba_sdk.conditions import BooleanCondition
from snuba_sdk.orderby import Direction, OrderBy

from sentry.api.utils import InvalidParams, get_date_range_from_params
from sentry.exceptions import InvalidSearchQuery
from sentry.models import Project
from sentry.search.events.builder import UnresolvedQuery
from sentry.sentry_metrics.utils import (
    STRING_NOT_FOUND,
    resolve_tag_key,
    resolve_weak,
    reverse_resolve,
    reverse_resolve_weak,
)
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.fields import metric_object_factory
from sentry.snuba.metrics.fields.base import (
    generate_bottom_up_dependency_tree_for_metrics,
    org_id_from_projects,
)
from sentry.snuba.metrics.naming_layer.mapping import get_mri, get_public_name_from_mri
from sentry.snuba.metrics.naming_layer.mri import MRI_NAME_REGEX
from sentry.snuba.metrics.naming_layer.public import PUBLIC_NAME_REGEX
from sentry.snuba.metrics.query import MetricField, MetricsQuery
from sentry.snuba.metrics.query import OrderBy as MetricsOrderBy
from sentry.snuba.metrics.query import Tag
from sentry.snuba.metrics.utils import (
    FIELD_ALIAS_MAPPINGS,
    OPERATIONS_PERCENTILES,
    TS_COL_GROUP,
    TS_COL_QUERY,
    DerivedMetricParseException,
    MetricDoesNotExistException,
    get_intervals,
)
from sentry.snuba.sessions_v2 import finite_or_none
from sentry.utils.dates import parse_stats_period, to_datetime
from sentry.utils.snuba import parse_snuba_datetime


def parse_field(field: str) -> MetricField:
    matches = PUBLIC_NAME_REGEX.match(field)
    try:
        if matches is None:
            raise TypeError
        operation = matches[1]
        metric_name = matches[2]
    except (IndexError, TypeError):
        operation = None
        metric_name = field
    return MetricField(operation, metric_name)


# Allow these snuba functions.
# These are only allowed because the parser in metrics_sessions_v2
# generates them. Long term we should not allow any functions, but rather
# a limited expression language with only AND, OR, IN and NOT IN
FUNCTION_ALLOWLIST = ("and", "or", "equals", "in")


def resolve_tags(org_id: int, input_: Any) -> Any:
    """Translate tags in snuba condition

    Column("metric_id") is not supported.
    """
    if input_ is None:
        return None
    if isinstance(input_, (list, tuple)):
        elements = [resolve_tags(org_id, item) for item in input_]
        # Lists are either arguments to IN or NOT IN. In both cases, we can
        # drop unknown strings:
        return [x for x in elements if x != STRING_NOT_FOUND]
    if isinstance(input_, Function):
        if input_.function == "ifNull":
            # This was wrapped automatically by QueryBuilder, remove wrapper
            return resolve_tags(org_id, input_.parameters[0])
        elif input_.function == "isNull":
            return Function(
                "equals",
                [
                    resolve_tags(org_id, input_.parameters[0]),
                    resolve_tags(org_id, ""),
                ],
            )
        elif input_.function in FUNCTION_ALLOWLIST:
            return Function(
                function=input_.function,
                parameters=input_.parameters
                and [resolve_tags(org_id, item) for item in input_.parameters],
            )
    if (
        isinstance(input_, Or)
        and len(input_.conditions) == 2
        and isinstance(c := input_.conditions[0], Condition)
        and isinstance(c.lhs, Function)
        and c.lhs.function == "isNull"
        and c.op == Op.EQ
        and c.rhs == 1
    ):
        # Remove another "null" wrapper. We should really write our own parser instead.
        return resolve_tags(org_id, input_.conditions[1])

    if isinstance(input_, Condition):
        if input_.op == Op.IS_NULL and input_.rhs is None:
            return Condition(
                lhs=resolve_tags(org_id, input_.lhs), op=Op.EQ, rhs=resolve_tags(org_id, "")
            )
        if (
            isinstance(input_.lhs, Function)
            and input_.lhs.function == "ifNull"
            and isinstance(input_.lhs.parameters[0], Column)
            and input_.lhs.parameters[0].name == "tags[project]"
        ):
            # Special condition as when we send a `project:<slug>` query, discover converter
            # converts it into a tags[project]:[<slug>] query, so we want to further process
            # the lhs to get to its translation of `project_id` but we don't go further resolve
            # rhs and we just want to extract the project ids from the slugs
            rhs = [p.id for p in Project.objects.filter(slug__in=input_.rhs)]
            return Condition(lhs=resolve_tags(org_id, input_.lhs), op=input_.op, rhs=rhs)
        return Condition(
            lhs=resolve_tags(org_id, input_.lhs), op=input_.op, rhs=resolve_tags(org_id, input_.rhs)
        )

    if isinstance(input_, BooleanCondition):
        return input_.__class__(
            conditions=[resolve_tags(org_id, item) for item in input_.conditions]
        )
    if isinstance(input_, Column):
        if input_.name == "project_id":
            return input_
        # HACK: Some tags already take the form "tags[...]" in discover, take that into account:
        if input_.subscriptable == "tags":
            # Handles translating field aliases to their "metrics" equivalent, for example
            # "project" -> "project_id"
            if input_.key in FIELD_ALIAS_MAPPINGS:
                return Column(FIELD_ALIAS_MAPPINGS[input_.key])
            name = input_.key
        else:
            name = input_.name
        return Column(name=resolve_tag_key(org_id, name))
    if isinstance(input_, str):
        return resolve_weak(org_id, input_)
    if isinstance(input_, int):
        return input_

    raise InvalidParams("Unable to resolve conditions")


def parse_query(query_string: str, projects: Sequence[Project]) -> Sequence[Condition]:
    """Parse given filter query into a list of snuba conditions"""
    # HACK: Parse a sessions query, validate / transform afterwards.
    # We will want to write our own grammar + interpreter for this later.
    try:
        query_builder = UnresolvedQuery(
            Dataset.Sessions,
            params={
                "project_id": [project.id for project in projects],
            },
        )
        where, _ = query_builder.resolve_conditions(query_string, use_aggregate_conditions=True)

    except InvalidSearchQuery as e:
        raise InvalidParams(f"Failed to parse query: {e}")
    return where


class QueryDefinition:
    """
    Class meant to serve as a thin layer that converts API request params to the fields necessary to
    instantiate an instance of `MetricsQuery`

    Adapted from [`sentry.snuba.sessions_v2`] and meant to keep consistency in naming between
    sessions v2 and metrics APIs.

    """

    def __init__(self, projects, query_params, paginator_kwargs: Optional[Dict] = None):
        self._projects = projects
        paginator_kwargs = paginator_kwargs or {}

        self.query = query_params.get("query", "")
        self.parsed_query = parse_query(self.query, projects) if self.query else None
        self.groupby = query_params.getlist("groupBy", [])
        self.fields = [parse_field(key) for key in query_params.getlist("field", [])]
        self.orderby = self._parse_orderby(query_params)
        self.limit: Optional[Limit] = self._parse_limit(paginator_kwargs)
        self.offset: Optional[Offset] = self._parse_offset(paginator_kwargs)

        start, end, rollup = get_date_range(query_params)
        self.rollup = rollup
        self.start = start
        self.end = end
        # Histogram fields
        self.histogram_buckets = int(query_params.get("histogramBuckets", 100))
        histogram_from = query_params.get("histogramFrom", None)
        histogram_to = query_params.get("histogramTo", None)
        self.histogram_from = float(histogram_from) if histogram_from is not None else None
        self.histogram_to = float(histogram_to) if histogram_to is not None else None
        self.include_series = query_params.get("includeSeries", "1") == "1"
        self.include_totals = query_params.get("includeTotals", "1") == "1"

    def to_metrics_query(self) -> MetricsQuery:
        return MetricsQuery(
            org_id=org_id_from_projects(self._projects),
            project_ids=[project.id for project in self._projects],
            include_totals=self.include_totals,
            include_series=self.include_series,
            select=self.fields,
            start=self.start,
            end=self.end,
            where=self.parsed_query,
            groupby=self.groupby,
            orderby=self.orderby,
            limit=self.limit,
            offset=self.offset,
            granularity=Granularity(self.rollup),
            histogram_buckets=self.histogram_buckets,
            histogram_from=self.histogram_from,
            histogram_to=self.histogram_to,
        )

    @staticmethod
    def _parse_orderby(query_params):
        orderbys = query_params.getlist("orderBy", [])
        if not orderbys:
            return None

        orderby_list = []
        for orderby in orderbys:
            direction = Direction.ASC
            if orderby[0] == "-":
                orderby = orderby[1:]
                direction = Direction.DESC

            field = parse_field(orderby)
            orderby_list.append(MetricsOrderBy(field, direction))

        return orderby_list

    @staticmethod
    def _parse_limit(paginator_kwargs) -> Optional[Limit]:
        if "limit" not in paginator_kwargs:
            return
        return Limit(paginator_kwargs["limit"])

    @staticmethod
    def _parse_offset(paginator_kwargs) -> Optional[Offset]:
        if "offset" not in paginator_kwargs:
            return
        return Offset(paginator_kwargs["offset"])


def get_date_range(params: Mapping) -> Tuple[datetime, datetime, int]:
    """Get start, end, rollup for the given parameters.

    Apply a similar logic as `sessions_v2.get_constrained_date_range`,
    but with fewer constraints. More constraints may be added in the future.

    Note that this function returns a right-exclusive date range [start, end),
    contrary to the one used in sessions_v2.

    """
    interval = parse_stats_period(params.get("interval", "1h"))
    interval = int(3600 if interval is None else interval.total_seconds())

    start, end = get_date_range_from_params(params, default_stats_period=timedelta(days=1))
    date_range = timedelta(
        seconds=int(
            interval
            * MetricsQuery.calculate_intervals_len(end=end, start=start, granularity=interval)
        )
    )

    end = to_datetime(
        int(interval * MetricsQuery.calculate_intervals_len(end=end, granularity=interval))
    )
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

    def __init__(self, projects: Sequence[Project], metrics_query: MetricsQuery):
        self._projects = projects
        self._metrics_query = metrics_query
        self._org_id = metrics_query.org_id

    def _build_where(self) -> List[Union[BooleanCondition, Condition]]:
        where: List[Union[BooleanCondition, Condition]] = [
            Condition(Column("org_id"), Op.EQ, self._org_id),
            Condition(Column("project_id"), Op.IN, self._metrics_query.project_ids),
            Condition(Column(TS_COL_QUERY), Op.GTE, self._metrics_query.start),
            Condition(Column(TS_COL_QUERY), Op.LT, self._metrics_query.end),
        ]
        filter_ = resolve_tags(self._org_id, self._metrics_query.where)
        if filter_:
            where.extend(filter_)

        return where

    def _build_groupby(self) -> List[Column]:
        groupby_cols = []
        for field in self._metrics_query.groupby or []:
            # Handles the case when we are trying to group by `project` for example, but we want
            # to translate it to `project_id` as that is what the metrics dataset understands
            if field in FIELD_ALIAS_MAPPINGS:
                groupby_cols.append(Column(FIELD_ALIAS_MAPPINGS[field]))
            elif field in FIELD_ALIAS_MAPPINGS.values():
                groupby_cols.append(Column(field))
            else:
                assert isinstance(field, Tag)
                groupby_cols.append(Column(resolve_tag_key(self._org_id, field)))
        return groupby_cols

    def _build_orderby(self) -> Optional[List[OrderBy]]:
        if self._metrics_query.orderby is None:
            return None
        # ToDo: Currently we only support one orderBy field, if this were to change then we would
        #  need to iterate over the list and generate orderBy instances accordingly
        assert len(self._metrics_query.orderby) == 1
        orderby = self._metrics_query.orderby[0]
        op = orderby.field.op
        metric_mri = get_mri(orderby.field.metric_name)
        metric_field_obj = metric_object_factory(op, metric_mri)

        return metric_field_obj.generate_orderby_clause(
            projects=self._projects,
            direction=orderby.direction,
            metrics_query=self._metrics_query,
        )

    def __build_totals_and_series_queries(
        self, entity, select, where, groupby, orderby, limit, offset, rollup, intervals_len
    ):
        rv = {}
        totals_query = Query(
            match=Entity(entity),
            groupby=groupby,
            select=select,
            where=where,
            limit=limit,
            offset=offset or Offset(0),
            granularity=rollup,
            orderby=orderby,
        )

        if self._metrics_query.include_totals:
            rv["totals"] = totals_query

        if self._metrics_query.include_series:
            series_limit = limit.limit * intervals_len
            rv["series"] = totals_query.set_limit(series_limit).set_groupby(
                list(totals_query.groupby or []) + [Column(TS_COL_GROUP)]
            )

        return rv

    def __update_query_dicts_with_component_entities(
        self, component_entities, metric_mri_to_obj_dict, fields_in_entities
    ):
        # At this point in time, we are only supporting raw metrics in the metrics attribute of
        # any instance of DerivedMetric, and so in this case the op will always be None
        # ToDo(ahmed): In future PR, we might want to allow for dependency metrics to also have an
        #  an aggregate and in this case, we would need to parse the op here
        op = None
        for entity, metric_mris in component_entities.items():
            for metric_mri in metric_mris:
                metric_key = (op, metric_mri)
                if metric_key not in metric_mri_to_obj_dict:
                    metric_mri_to_obj_dict[metric_key] = metric_object_factory(op, metric_mri)
                    fields_in_entities.setdefault(entity, []).append(metric_key)
        return metric_mri_to_obj_dict

    def get_snuba_queries(self):
        metric_mri_to_obj_dict = {}
        fields_in_entities = {}

        for field in self._metrics_query.select:
            metric_mri = get_mri(field.metric_name)
            metric_field_obj = metric_object_factory(field.op, metric_mri)
            # `get_entity` is called the first, to fetch the entities of constituent metrics,
            # and validate especially in the case of SingularEntityDerivedMetric that it is
            # actually composed of metrics that belong to the same entity
            try:
                #  When we get to an instance of a MetricFieldBase where the entity is an
                #  instance of dict, we know it is from a composite entity derived metric, and
                #  we need to traverse down the constituent metrics dependency tree until we get
                #  to instances of SingleEntityDerivedMetric, and add those to our queries so
                #  that we are able to generate the original CompositeEntityDerivedMetric later
                #  on as a result of a post query operation on the results of the constituent
                #  SingleEntityDerivedMetric instances
                component_entities = metric_field_obj.get_entity(projects=self._projects)
                if isinstance(component_entities, dict):
                    # In this case, component_entities is a dictionary with entity keys and
                    # lists of metric_mris as values representing all the entities and
                    # metric_mris combination that this metric_object is composed of, or rather
                    # the instances of SingleEntityDerivedMetric that it is composed of
                    metric_mri_to_obj_dict = self.__update_query_dicts_with_component_entities(
                        component_entities=component_entities,
                        metric_mri_to_obj_dict=metric_mri_to_obj_dict,
                        fields_in_entities=fields_in_entities,
                    )
                    continue
                elif isinstance(component_entities, str):
                    entity = component_entities
                else:
                    raise DerivedMetricParseException("Entity parsed is in incorrect format")
            except MetricDoesNotExistException:
                # If we get here, it means that one or more of the constituent metrics for a
                # derived metric does not exist, and so no further attempts to query that derived
                # metric will be made, and the field value will be set to the default value in
                # the response
                continue

            if entity not in self._implemented_datasets:
                raise NotImplementedError(f"Dataset not yet implemented: {entity}")

            metric_mri_to_obj_dict[(field.op, metric_mri)] = metric_field_obj
            fields_in_entities.setdefault(entity, []).append((field.op, metric_mri))

        where = self._build_where()
        groupby = self._build_groupby()

        queries_dict = {}
        for entity, fields in fields_in_entities.items():
            select = []
            metric_ids_set = set()
            for field in fields:
                metric_field_obj = metric_mri_to_obj_dict[field]
                select += metric_field_obj.generate_select_statements(
                    projects=self._projects, metrics_query=self._metrics_query
                )
                metric_ids_set |= metric_field_obj.generate_metric_ids(self._projects)

            where_for_entity = [
                Condition(
                    Column("metric_id"),
                    Op.IN,
                    list(metric_ids_set),
                ),
            ]
            orderby = self._build_orderby()

            queries_dict[entity] = self.__build_totals_and_series_queries(
                entity=entity,
                select=select,
                where=where + where_for_entity,
                groupby=groupby,
                orderby=orderby,
                limit=self._metrics_query.limit,
                offset=self._metrics_query.offset,
                rollup=self._metrics_query.granularity,
                intervals_len=len(
                    list(
                        get_intervals(
                            self._metrics_query.start,
                            self._metrics_query.end,
                            self._metrics_query.granularity.granularity,
                        )
                    )
                ),
            )

        return queries_dict, fields_in_entities


class SnubaResultConverter:
    """Interpret a Snuba result and convert it to API format"""

    def __init__(
        self,
        organization_id: int,
        metrics_query: MetricsQuery,
        fields_in_entities: dict,
        intervals: List[datetime],
        results,
    ):
        self._organization_id = organization_id
        self._intervals = intervals
        self._results = results
        self._metrics_query = metrics_query

        # This is a set of all the `(op, metric_mri)` combinations passed in the metrics_query
        self._metrics_query_fields_set = {
            (field.op, get_mri(field.metric_name)) for field in metrics_query.select
        }
        # This is a set of all queryable `(op, metric_mri)` combinations. Queryable can mean it
        # includes one of the following: AggregatedRawMetric (op, metric_mri), instance of
        # SingularEntityDerivedMetric or the instances of SingularEntityDerivedMetric that are
        # the constituents necessary to calculate instances of CompositeEntityDerivedMetric but
        # are not necessarily requested in the query definition
        self._fields_in_entities_set = {
            elem for fields_in_entity in fields_in_entities.values() for elem in fields_in_entity
        }
        self._set_of_constituent_queries = self._fields_in_entities_set.union(
            self._metrics_query_fields_set
        )

        # This basically generate a dependency tree for all instances of `MetricFieldBase` so
        # that in the case of a CompositeEntityDerivedMetric, we are able to calculate it but
        # only after calculating its dependencies
        self._bottom_up_dependency_tree = generate_bottom_up_dependency_tree_for_metrics(
            self._metrics_query_fields_set
        )

        self._timestamp_index = {timestamp: index for index, timestamp in enumerate(intervals)}

    def _parse_tag(self, tag_string: str) -> str:
        tag_key = int(tag_string.replace("tags[", "").replace("]", ""))
        return reverse_resolve(tag_key)

    def _extract_data(self, data, groups):
        tags = tuple(
            (key, data[key])
            for key in sorted(data.keys())
            if (key.startswith("tags[") or key in FIELD_ALIAS_MAPPINGS.values())
        )

        tag_data = groups.setdefault(tags, {})
        if self._metrics_query.include_series:
            tag_data.setdefault("series", {})
        if self._metrics_query.include_totals:
            tag_data.setdefault("totals", {})

        bucketed_time = data.pop(TS_COL_GROUP, None)
        if bucketed_time is not None:
            bucketed_time = parse_snuba_datetime(bucketed_time)

        # We query the union of the metrics_query fields, and the fields_in_entities from the
        # QueryBuilder necessary as it contains the constituent instances of
        # SingularEntityDerivedMetric for instances of CompositeEntityDerivedMetric
        for op, metric_mri in self._set_of_constituent_queries:
            key = f"{op}({metric_mri})" if op is not None else metric_mri
            default_null_value = metric_object_factory(
                op, metric_mri
            ).generate_default_null_values()

            try:
                value = data[key]
            except KeyError:
                # This could occur when we have derived metrics that are generated from post
                # query operations, and so don't have a direct mapping to the query results
                # or also from raw_metrics that don't exist in clickhouse yet
                cleaned_value = default_null_value
            else:
                if op in OPERATIONS_PERCENTILES:
                    value = value[0]
                cleaned_value = finite_or_none(value)

            if bucketed_time is None:
                # Only update the value, when either key does not exist or its a default
                if key not in tag_data["totals"] or tag_data["totals"][key] == default_null_value:
                    tag_data["totals"][key] = cleaned_value

            if self._metrics_query.include_series:
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
            for k in "totals", "series":
                if k in subresults:
                    for data in subresults[k]["data"]:
                        self._extract_data(data, groups)

        groups = [
            dict(
                by=dict(
                    (self._parse_tag(key), reverse_resolve_weak(value))
                    if key not in FIELD_ALIAS_MAPPINGS.values()
                    else (key, value)
                    for key, value in tags
                ),
                **data,
            )
            for tags, data in groups.items()
        ]

        # Applying post query operations for totals and series
        for group in groups:
            totals = group.get("totals")
            series = group.get("series")

            for op, metric_mri in self._bottom_up_dependency_tree:
                metric_obj = metric_object_factory(op=op, metric_mri=metric_mri)
                grp_key = f"{op}({metric_mri})" if op is not None else metric_mri

                if totals is not None:
                    totals[grp_key] = metric_obj.run_post_query_function(
                        totals, metrics_query=self._metrics_query
                    )

                if series is not None:
                    # Series
                    for idx in range(0, len(self._intervals)):
                        series.setdefault(
                            grp_key,
                            [metric_obj.generate_default_null_values()] * len(self._intervals),
                        )
                        series[grp_key][idx] = metric_obj.run_post_query_function(
                            series, metrics_query=self._metrics_query, idx=idx
                        )

        # Remove the extra fields added due to the constituent metrics that were added
        # from the generated dependency tree. These metrics that are to be removed were added to
        # be able to generate fields that require further processing post query, but are not
        # required nor expected in the response
        for group in groups:
            totals = group.get("totals")
            series = group.get("series")

            for key in set(totals or ()) | set(series or ()):
                matches = MRI_NAME_REGEX.match(key)
                if matches:
                    operation = matches[1]
                    metric_mri = matches[2]
                else:
                    operation = None
                    metric_mri = key

                if (operation, metric_mri) not in self._metrics_query_fields_set:
                    if totals is not None:
                        del totals[key]
                    if series is not None:
                        del series[key]
                else:
                    public_metric_key = (
                        f"{get_public_name_from_mri(metric_mri)}"
                        if operation is None
                        else f"{operation}({get_public_name_from_mri(metric_mri)})"
                    )
                    if totals is not None:
                        totals[public_metric_key] = totals.pop(key)
                    if series is not None:
                        series[public_metric_key] = series.pop(key)

        return groups
