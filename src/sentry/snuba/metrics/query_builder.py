__all__ = (
    "QueryDefinition",
    "SnubaQueryBuilder",
    "SnubaResultConverter",
    "get_date_range",
    "parse_field",
    "parse_query",
    "resolve_tags",
    "translate_meta_results",
)

from datetime import datetime, timedelta
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple, Union

from snuba_sdk import (
    AliasedExpression,
    Column,
    Condition,
    Entity,
    Function,
    Granularity,
    Limit,
    Offset,
    Op,
    Or,
    Query,
)
from snuba_sdk.conditions import BooleanCondition
from snuba_sdk.orderby import Direction, OrderBy

from sentry.api.utils import InvalidParams, get_date_range_from_params
from sentry.exceptions import InvalidSearchQuery
from sentry.models import Project
from sentry.search.events.builder import UnresolvedQuery
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.utils import (
    STRING_NOT_FOUND,
    resolve_tag_key,
    resolve_tag_value,
    resolve_weak,
    reverse_resolve,
    reverse_resolve_tag_value,
)
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.fields import metric_object_factory
from sentry.snuba.metrics.fields.base import (
    COMPOSITE_ENTITY_CONSTITUENT_ALIAS,
    MetricExpressionBase,
    generate_bottom_up_dependency_tree_for_metrics,
    org_id_from_projects,
)
from sentry.snuba.metrics.naming_layer.mapping import (
    get_mri,
    get_operation_with_public_name,
    parse_expression,
)
from sentry.snuba.metrics.naming_layer.public import PUBLIC_EXPRESSION_REGEX
from sentry.snuba.metrics.query import (
    MetricConditionField,
    MetricField,
    MetricGroupByField,
    MetricsQuery,
)
from sentry.snuba.metrics.query import OrderBy as MetricsOrderBy
from sentry.snuba.metrics.query import Tag
from sentry.snuba.metrics.utils import (
    DATASET_COLUMNS,
    FIELD_ALIAS_MAPPINGS,
    NON_RESOLVABLE_TAG_VALUES,
    OPERATIONS_PERCENTILES,
    TS_COL_GROUP,
    TS_COL_QUERY,
    DerivedMetricParseException,
    MetricDoesNotExistException,
    get_intervals,
    require_rhs_condition_resolution,
)
from sentry.snuba.sessions_v2 import finite_or_none
from sentry.utils.dates import parse_stats_period, to_datetime
from sentry.utils.snuba import parse_snuba_datetime


def parse_field(field: str) -> MetricField:
    matches = PUBLIC_EXPRESSION_REGEX.match(field)
    try:
        if matches is None:
            raise TypeError
        operation = matches[1]
        metric_name = matches[2]
    except (IndexError, TypeError):
        operation = None
        metric_name = field
    return MetricField(operation, get_mri(metric_name))


# Allow these snuba functions.
# These are only allowed because the parser in metrics_sessions_v2
# generates them. Long term we should not allow any functions, but rather
# a limited expression language with only AND, OR, IN and NOT IN
FUNCTION_ALLOWLIST = ("and", "or", "equals", "in", "tuple", "has")


def resolve_tags(
    use_case_id: UseCaseKey, org_id: int, input_: Any, is_tag_value: bool = False
) -> Any:
    """Translate tags in snuba condition

    Column("metric_id") is not supported.
    """
    if input_ is None:
        return None
    if isinstance(input_, (list, tuple)):
        elements = [resolve_tags(use_case_id, org_id, item, is_tag_value=True) for item in input_]
        # Lists are either arguments to IN or NOT IN. In both cases, we can
        # drop unknown strings.
        filtered_elements = [x for x in elements if x != STRING_NOT_FOUND]
        # We check whether it is a list or tuple in order to know which type to return. This is needed
        # because in the "tuple" function the parameters must be a list of tuples and not a list of lists.
        return filtered_elements if isinstance(input_, list) else tuple(filtered_elements)
    if isinstance(input_, Function):
        if input_.function == "ifNull":
            # This was wrapped automatically by QueryBuilder, remove wrapper
            return resolve_tags(use_case_id, org_id, input_.parameters[0])
        elif input_.function == "isNull":
            return Function(
                "equals",
                [
                    resolve_tags(use_case_id, org_id, input_.parameters[0]),
                    resolve_tags(use_case_id, org_id, "", is_tag_value=True),
                ],
            )
        elif input_.function in FUNCTION_ALLOWLIST:
            return Function(
                function=input_.function,
                parameters=input_.parameters
                and [resolve_tags(use_case_id, org_id, item) for item in input_.parameters],
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
        return resolve_tags(use_case_id, org_id, input_.conditions[1])

    if isinstance(input_, Condition):
        if input_.op == Op.IS_NULL and input_.rhs is None:
            return Condition(
                lhs=resolve_tags(use_case_id, org_id, input_.lhs),
                op=Op.EQ,
                rhs=resolve_tags(use_case_id, org_id, "", is_tag_value=True),
            )
        if (
            isinstance(input_.lhs, Function)
            and input_.lhs.function == "ifNull"
            and isinstance(input_.lhs.parameters[0], Column)
            and input_.lhs.parameters[0].name in ("tags[project]", "tags_raw[project]")
        ):
            # Special condition as when we send a `project:<slug>` query, discover converter
            # converts it into a tags[project]:[<slug>] query, so we want to further process
            # the lhs to get to its translation of `project_id` but we don't go further resolve
            # rhs and we just want to extract the project ids from the slugs
            rhs_slugs = [input_.rhs] if isinstance(input_.rhs, str) else input_.rhs

            try:
                op = {Op.EQ: Op.IN, Op.IN: Op.IN, Op.NEQ: Op.NOT_IN, Op.NOT_IN: Op.NOT_IN}[
                    input_.op
                ]
            except KeyError:
                raise InvalidParams(f"Unable to resolve operation {input_.op} for project filter")

            rhs_ids = [p.id for p in Project.objects.filter(slug__in=rhs_slugs)]
            return Condition(lhs=resolve_tags(use_case_id, org_id, input_.lhs), op=op, rhs=rhs_ids)
        return Condition(
            lhs=resolve_tags(use_case_id, org_id, input_.lhs),
            op=input_.op,
            rhs=resolve_tags(use_case_id, org_id, input_.rhs, is_tag_value=True),
        )

    if isinstance(input_, BooleanCondition):
        return input_.__class__(
            conditions=[resolve_tags(use_case_id, org_id, item) for item in input_.conditions]
        )
    if isinstance(input_, Column):
        # If a column has the name belonging to the set, it means that we don't need to resolve its name.
        if input_.name in frozenset(["project_id", "tags.key"]):
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

        return Column(name=resolve_tag_key(use_case_id, org_id, name))
    if isinstance(input_, str):
        if is_tag_value:
            return resolve_tag_value(use_case_id, org_id, input_)
        else:
            return resolve_weak(use_case_id, org_id, input_)
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
                "organization_id": org_id_from_projects(projects) if projects else None,
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
        self.groupby = [
            MetricGroupByField(groupby_col) for groupby_col in query_params.getlist("groupBy", [])
        ]
        self.fields = [parse_field(key) for key in query_params.getlist("field", [])]
        self.orderby = self._parse_orderby(query_params)
        self.limit: Optional[Limit] = self._parse_limit(paginator_kwargs)
        self.offset: Optional[Offset] = self._parse_offset(paginator_kwargs)

        start, end, rollup = get_date_range(query_params)
        self.rollup = rollup
        self.start = start
        self.end = end
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


def parse_tag(use_case_id: UseCaseKey, org_id: int, tag_string: str) -> str:
    tag_key = int(tag_string.replace("tags_raw[", "").replace("tags[", "").replace("]", ""))
    return reverse_resolve(use_case_id, org_id, tag_key)


def get_metric_object_from_metric_field(metric_field: MetricField) -> MetricExpressionBase:
    """Get the metric object from a metric field"""
    return metric_object_factory(op=metric_field.op, metric_mri=metric_field.metric_mri)


def translate_meta_results(
    meta: Sequence[Dict[str, str]],
    alias_to_metric_field: Dict[str, MetricField],
    alias_to_metric_group_by_field: Dict[str, MetricGroupByField],
) -> Sequence[Dict[str, str]]:
    """
    Translate meta results:
    it makes all metrics are public and resolve tag names
    E.g.:
    p50(d:transactions/measurements.lcp@millisecond) -> p50(transaction.measurements.lcp)
    tags[9223372036854776020] -> transaction
    """
    results = []
    for record in meta:
        operation, column_name = parse_expression(record["name"])

        # Column name could be either a mri, ["bucketed_time"] or a tag or a dataset col like
        # "project_id" or "metric_id"
        is_tag = column_name in alias_to_metric_group_by_field.keys()
        is_time_col = column_name in [TS_COL_GROUP]
        is_dataset_col = column_name in DATASET_COLUMNS

        if not (is_tag or is_time_col or is_dataset_col):
            # This handles two cases where we have an expression with an operation and an mri,
            # or a derived metric mri that has no associated operation
            try:
                record["name"] = get_operation_with_public_name(operation, column_name)
                if COMPOSITE_ENTITY_CONSTITUENT_ALIAS in record["name"]:
                    # Since instances of CompositeEntityDerivedMetric will not have meta data as they are computed post
                    # query, it suffices to set the type of that composite derived metric to any of the types of its
                    # constituents, and in doing so we assume that the constituents will have compatible types, and so
                    # it is a safe assumption to make.
                    parent_alias = record["name"].split(COMPOSITE_ENTITY_CONSTITUENT_ALIAS)[1]
                    if parent_alias not in {elem["name"] for elem in results}:
                        try:
                            defined_parent_meta_type = get_metric_object_from_metric_field(
                                alias_to_metric_field[parent_alias]
                            ).get_meta_type()
                        except KeyError:
                            defined_parent_meta_type = None

                        results.append(
                            {
                                "name": parent_alias,
                                "type": record["type"]
                                if defined_parent_meta_type is None
                                else defined_parent_meta_type,
                            }
                        )
                    continue
                if record["name"] not in alias_to_metric_field.keys():
                    raise InvalidParams(f"Field {record['name']} was not in the select clause")

                defined_parent_meta_type = get_metric_object_from_metric_field(
                    alias_to_metric_field[record["name"]]
                ).get_meta_type()
                record["type"] = (
                    record["type"] if defined_parent_meta_type is None else defined_parent_meta_type
                )
            except InvalidParams:
                # XXX(ahmed): We get into this branch when we are tying to generate inferred types
                # for instances of `CompositeEntityDerivedMetric` as type needs to be inferred from
                # its constituent instances of `SingularEntityDerivedMetric`, and we decide to skip
                # trying to infer this type for the time being as there is no product requirement
                # for it. However, if a product requirement arises for this, then we need to
                # implement type inference logic that potentially infers types from the
                # arithmetic operations applied on the constituent
                # For example, If we have two constituents of types "UInt64" and "Float64",
                # then there inferred type would be "Float64"
                continue
        else:
            if is_tag:
                # since we changed value from int to str we need
                # also want to change type
                metric_groupby_field = alias_to_metric_group_by_field[record["name"]]
                if isinstance(metric_groupby_field.field, MetricField):
                    defined_parent_meta_type = get_metric_object_from_metric_field(
                        metric_groupby_field.field
                    ).get_meta_type()
                else:
                    defined_parent_meta_type = None

                record["type"] = (
                    "string" if defined_parent_meta_type is None else defined_parent_meta_type
                )
            elif is_time_col or is_dataset_col:
                record["name"] = column_name

        if record not in results:
            results.append(record)
    return sorted(results, key=lambda elem: elem["name"])


class SnubaQueryBuilder:

    #: Datasets actually implemented in snuba:
    _implemented_datasets = {
        "metrics_counters",
        "metrics_distributions",
        "metrics_sets",
        "generic_metrics_counters",
        "generic_metrics_distributions",
        "generic_metrics_sets",
    }

    def __init__(
        self, projects: Sequence[Project], metrics_query: MetricsQuery, use_case_id: UseCaseKey
    ):
        self._projects = projects
        self._metrics_query = metrics_query
        self._org_id = metrics_query.org_id
        self._use_case_id = use_case_id

        self._alias_to_metric_field = {field.alias: field for field in self._metrics_query.select}

    @staticmethod
    def generate_snql_for_groupby_field(
        metric_groupby_obj: MetricGroupByField,
        use_case_id: UseCaseKey,
        org_id: int,
        projects: Sequence[Project],
        is_column: bool = False,
    ) -> Union[Column, AliasedExpression, Function]:
        if isinstance(metric_groupby_obj.field, str):
            # Handles the case when we are trying to group by `project` for example, but we want
            # to translate it to `project_id` as that is what the metrics dataset understands
            if metric_groupby_obj.field in FIELD_ALIAS_MAPPINGS:
                column_name = FIELD_ALIAS_MAPPINGS[metric_groupby_obj.field]
            elif metric_groupby_obj.field in FIELD_ALIAS_MAPPINGS.values():
                column_name = metric_groupby_obj.field
            else:
                assert isinstance(metric_groupby_obj.field, Tag)
                column_name = resolve_tag_key(use_case_id, org_id, metric_groupby_obj.field)
            return (
                AliasedExpression(
                    exp=Column(column_name),
                    alias=metric_groupby_obj.alias,
                )
                if not is_column
                else Column(column_name)
            )

        elif isinstance(metric_groupby_obj.field, MetricField):
            try:
                metric_expression = metric_object_factory(
                    metric_groupby_obj.field.op, metric_groupby_obj.field.metric_mri
                )
                return metric_expression.generate_groupby_statements(
                    use_case_id=use_case_id,
                    alias=metric_groupby_obj.field.alias,
                    params=metric_groupby_obj.field.params,
                    projects=projects,
                )[0]
            except IndexError:
                raise InvalidParams(f"Cannot resolve {metric_groupby_obj.field} into SnQL")
        else:
            raise NotImplementedError(f"Unsupported groupby field: {metric_groupby_obj.field}")

    def _build_where(self) -> List[Union[BooleanCondition, Condition]]:
        where: List[Union[BooleanCondition, Condition]] = [
            Condition(Column("org_id"), Op.EQ, self._org_id),
            Condition(Column("project_id"), Op.IN, self._metrics_query.project_ids),
            Condition(Column(TS_COL_QUERY), Op.GTE, self._metrics_query.start),
            Condition(Column(TS_COL_QUERY), Op.LT, self._metrics_query.end),
        ]
        if not self._metrics_query.where:
            return where

        snuba_conditions = []
        # Adds filters that do not need to be resolved because they are instances of `MetricConditionField`
        metric_condition_filters = []
        for condition in self._metrics_query.where:
            if isinstance(condition, MetricConditionField):
                metric_expression = metric_object_factory(
                    condition.lhs.op, condition.lhs.metric_mri
                )
                try:
                    metric_condition_filters.append(
                        Condition(
                            lhs=metric_expression.generate_where_statements(
                                use_case_id=self._use_case_id,
                                params=condition.lhs.params,
                                projects=self._projects,
                                alias=condition.lhs.alias,
                            )[0],
                            op=condition.op,
                            rhs=resolve_tag_value(self._use_case_id, self._org_id, condition.rhs)
                            if require_rhs_condition_resolution(condition.lhs.op)
                            else condition.rhs,
                        )
                    )
                except IndexError:
                    raise InvalidParams(f"Cannot resolve {condition.lhs} into SnQL")
            else:
                snuba_conditions.append(condition)

        if metric_condition_filters:
            where.extend(metric_condition_filters)

        filter_ = resolve_tags(self._use_case_id, self._org_id, snuba_conditions)
        if filter_:
            where.extend(filter_)

        return where

    def _build_groupby(self) -> List[Column]:
        groupby_cols = []

        for metric_groupby_obj in self._metrics_query.groupby or []:
            groupby_cols.append(
                self.generate_snql_for_groupby_field(
                    metric_groupby_obj=metric_groupby_obj,
                    use_case_id=self._use_case_id,
                    org_id=self._org_id,
                    projects=self._projects,
                )
            )
        return groupby_cols

    def _build_orderby(self) -> Optional[List[OrderBy]]:
        if self._metrics_query.orderby is None:
            return None

        orderby_fields = []
        for orderby in self._metrics_query.orderby:
            op = orderby.field.op
            metric_field_obj = metric_object_factory(op, orderby.field.metric_mri)
            orderby_fields.extend(
                metric_field_obj.generate_orderby_clause(
                    projects=self._projects,
                    direction=orderby.direction,
                    params=orderby.field.params,
                    use_case_id=self._use_case_id,
                    alias=orderby.field.alias,
                )
            )
        return orderby_fields

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

            if self._use_case_id == UseCaseKey.PERFORMANCE:
                time_groupby_column = self.__generate_time_groupby_column_for_discover_queries(
                    self._metrics_query.interval
                )
            else:
                time_groupby_column = Column(TS_COL_GROUP)

            rv["series"] = totals_query.set_limit(series_limit).set_groupby(
                list(totals_query.groupby or []) + [time_groupby_column]
            )

        return rv

    @staticmethod
    def __generate_time_groupby_column_for_discover_queries(interval: int) -> Function:
        return Function(
            function="toStartOfInterval",
            parameters=[
                Column(name="timestamp"),
                Function(
                    function="toIntervalSecond",
                    parameters=[interval],
                    alias=None,
                ),
                "Universal",
            ],
            alias=TS_COL_GROUP,
        )

    def __update_query_dicts_with_component_entities(
        self, component_entities, metric_mri_to_obj_dict, fields_in_entities, parent_alias
    ):
        # At this point in time, we are only supporting raw metrics in the metrics attribute of
        # any instance of DerivedMetric, and so in this case the op will always be None
        # ToDo(ahmed): In future PR, we might want to allow for dependency metrics to also have an
        #  an aggregate and in this case, we would need to parse the op here
        op = None
        for entity, metric_mris in component_entities.items():
            for metric_mri in metric_mris:
                # The constituents of an instance of CompositeEntityDerivedMetric will have a reference to their parent
                # alias so that we are able to distinguish the constituents in case we have naming collisions that could
                # potentially occur from requesting the same CompositeEntityDerivedMetric multiple times with different
                # params. This means that if parent composite metric alias is for example sessions_errored, and it has
                # a constituent `e:sessions/error.unique@none` then that constituent will be aliased as
                # `e:sessions/error.unique@none__CHILD_OF__sessions_errored`
                metric_key = (
                    op,
                    metric_mri,
                    f"{metric_mri}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{parent_alias}",
                )
                if metric_key not in metric_mri_to_obj_dict:
                    metric_mri_to_obj_dict[metric_key] = metric_object_factory(op, metric_mri)
                    fields_in_entities.setdefault(entity, []).append(metric_key)
        return metric_mri_to_obj_dict

    def get_snuba_queries(self):
        metric_mri_to_obj_dict = {}
        fields_in_entities = {}

        for field in self._metrics_query.select:
            metric_field_obj = metric_object_factory(field.op, field.metric_mri)
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
                component_entities = metric_field_obj.get_entity(
                    projects=self._projects, use_case_id=self._use_case_id
                )
                if isinstance(component_entities, dict):
                    # In this case, component_entities is a dictionary with entity keys and
                    # lists of metric_mris as values representing all the entities and
                    # metric_mris combination that this metric_object is composed of, or rather
                    # the instances of SingleEntityDerivedMetric that it is composed of
                    metric_mri_to_obj_dict = self.__update_query_dicts_with_component_entities(
                        component_entities=component_entities,
                        metric_mri_to_obj_dict=metric_mri_to_obj_dict,
                        fields_in_entities=fields_in_entities,
                        parent_alias=field.alias,
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

            metric_mri_to_obj_dict[(field.op, field.metric_mri, field.alias)] = metric_field_obj
            fields_in_entities.setdefault(entity, []).append(
                (field.op, field.metric_mri, field.alias)
            )

        where = self._build_where()
        groupby = self._build_groupby()

        queries_dict = {}
        for entity, fields in fields_in_entities.items():
            select = []
            metric_ids_set = set()
            for field in fields:
                metric_field_obj = metric_mri_to_obj_dict[field]
                try:
                    params = self._alias_to_metric_field[field[2]].params
                except KeyError:
                    params = None
                select += metric_field_obj.generate_select_statements(
                    projects=self._projects,
                    use_case_id=self._use_case_id,
                    alias=field[2],
                    params=params,
                )
                metric_ids_set |= metric_field_obj.generate_metric_ids(
                    self._projects, self._use_case_id
                )

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
                            interval=self._metrics_query.interval,
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
        use_case_id: UseCaseKey,
    ):
        self._organization_id = organization_id
        self._intervals = intervals
        self._results = results
        self._metrics_query = metrics_query
        self._use_case_id = use_case_id
        # This dictionary is required because at the very end when we want to remove all the extra constituents that
        # were returned by the query, and the only thing we have is the alias, we need a mapping from the alias to
        # the metric object that that alias represents
        self._alias_to_metric_field = {field.alias: field for field in self._metrics_query.select}

        # This is a set of all the `(op, metric_mri, alias)` combinations passed in the metrics_query
        self._metrics_query_fields_set = {
            (field.op, field.metric_mri, field.alias) for field in metrics_query.select
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

    def _extract_data(self, data, groups):
        group_key_aliases = (
            {metric_groupby_obj.alias for metric_groupby_obj in self._metrics_query.groupby}
            if self._metrics_query.groupby
            else set()
        )
        tags = tuple((key, data[key]) for key in sorted(data.keys()) if key in group_key_aliases)

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
        for op, metric_mri, alias in self._set_of_constituent_queries:
            default_null_value = metric_object_factory(
                op, metric_mri
            ).generate_default_null_values()

            try:
                value = data[alias]
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
                if (
                    alias not in tag_data["totals"]
                    or tag_data["totals"][alias] == default_null_value
                ):
                    tag_data["totals"][alias] = cleaned_value

            if self._metrics_query.include_series:
                if bucketed_time is not None or tag_data["totals"][alias] == default_null_value:
                    empty_values = len(self._intervals) * [default_null_value]
                    series = tag_data["series"].setdefault(alias, empty_values)

                    if bucketed_time is not None:
                        series_index = self._timestamp_index[bucketed_time]
                        if series[series_index] == default_null_value:
                            series[series_index] = cleaned_value

    def translate_result_groups(self):
        groups = {}
        for _, subresults in self._results.items():
            for k in "totals", "series":
                if k in subresults:
                    for data in subresults[k]["data"]:
                        self._extract_data(data, groups)

        # Creating this dictionary serves the purpose of having a mapping from the alias of a groupBy column to the
        # original groupBy column, and we need this to determine for which tag values we don't need to reverse resolve
        # in the indexer. As an example, we do not want to reverse resolve tag values for project_ids.
        # Another exception is `team_key_transaction` derived op since we don't want to reverse resolve its value as
        # it is just a boolean. Therefore we rely on creating a mapping from the alias to the operation in this case
        # to determine whether we need to reverse the tag value or not.
        groupby_alias_to_groupby_column = (
            {
                metric_groupby_obj.alias: metric_groupby_obj.field
                if isinstance(metric_groupby_obj.field, str)
                else metric_groupby_obj.field.op
                for metric_groupby_obj in self._metrics_query.groupby
            }
            if self._metrics_query.groupby
            else {}
        )

        groups = [
            dict(
                by=dict(
                    (
                        key,
                        reverse_resolve_tag_value(
                            self._use_case_id, self._organization_id, value, weak=True
                        ),
                    )
                    if groupby_alias_to_groupby_column.get(key) not in NON_RESOLVABLE_TAG_VALUES
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

            for op, metric_mri, alias in self._bottom_up_dependency_tree:
                metric_obj = metric_object_factory(op=op, metric_mri=metric_mri)
                if totals is not None:
                    try:
                        params = self._alias_to_metric_field[alias].params
                    except KeyError:
                        params = None
                    totals[alias] = metric_obj.run_post_query_function(
                        totals, params=params, alias=alias
                    )

                if series is not None:
                    # Series
                    for idx in range(0, len(self._intervals)):
                        series.setdefault(
                            alias,
                            [metric_obj.generate_default_null_values()] * len(self._intervals),
                        )
                        try:
                            params = self._alias_to_metric_field[alias].params
                        except KeyError:
                            params = None
                        series[alias][idx] = metric_obj.run_post_query_function(
                            series, params=params, idx=idx, alias=alias
                        )

        # Remove the extra fields added due to the constituent metrics that were added
        # from the generated dependency tree. These metrics that are to be removed were added to
        # be able to generate fields that require further processing post query, but are not
        # required nor expected in the response
        for group in groups:
            totals = group.get("totals")
            series = group.get("series")

            for key in set(totals or ()) | set(series or ()):
                metric_field = self._alias_to_metric_field.get(key)

                if not metric_field:
                    if totals is not None:
                        del totals[key]
                    if series is not None:
                        del series[key]
        return groups
