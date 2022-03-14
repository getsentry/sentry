"""
Module that gets both metadata and time series from Snuba.
For metadata, it fetch metrics metadata (metric names, tag names, tag values, ...) from snuba.
This is not intended for production use, but rather as an intermediate solution
until we have a proper metadata store set up. To keep things simple, and hopefully reasonably
efficient, we only look at the past 24 hours.
"""

__all__ = (
    "get_metrics",
    "get_tags",
    "get_tag_values",
    "get_series",
)

from collections import defaultdict
from copy import copy
from operator import itemgetter
from typing import Any, Dict, Mapping, Optional, Sequence, Set

from snuba_sdk import Column, Condition, Function, Op

from sentry.api.utils import InvalidParams
from sentry.models import Project
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.utils import resolve_tag_key, reverse_resolve
from sentry.snuba.dataset import EntityKey
from sentry.snuba.metrics.fields import DERIVED_METRICS, run_metrics_query
from sentry.snuba.metrics.query_builder import (
    ALLOWED_GROUPBY_COLUMNS,
    QueryDefinition,
    SnubaQueryBuilder,
    SnubaResultConverter,
    get_intervals,
    parse_field,
)
from sentry.snuba.metrics.utils import (
    AVAILABLE_OPERATIONS,
    METRIC_TYPE_TO_ENTITY,
    DerivedMetricParseException,
    MetricDoesNotExistInIndexer,
    MetricMeta,
    MetricType,
    Tag,
    TagValue,
)
from sentry.utils.snuba import raw_snql_query


def _get_metrics_for_entity(entity_key: EntityKey, projects, org_id) -> Mapping[str, Any]:
    return run_metrics_query(
        entity_key=entity_key,
        select=[Column("metric_id")],
        groupby=[Column("metric_id")],
        where=[],
        referrer="snuba.metrics.get_metrics_names_for_entity",
        projects=projects,
        org_id=org_id,
    )


def get_available_derived_metrics(
    supported_metric_ids_in_entities: Dict[MetricType, Sequence[int]],
    derived_metric_names: Optional[Set[str]] = None,
) -> Set[str]:
    """
    Function that takes as input a dictionary of the available ids in each entity,
    and an optional derived metric names set, and in turn goes through each derived metric (or
    each derived metric from the input set of provided), and returns back a set of the derived
    metrics that have data in the dataset.
    """
    requested_derived_metrics = (
        {
            derived_metric_name: DERIVED_METRICS[derived_metric_name]
            for derived_metric_name in derived_metric_names
        }
        if derived_metric_names
        else DERIVED_METRICS
    )

    found_derived_metrics = set()
    for derived_metric_name, derived_metric_obj in requested_derived_metrics.items():
        derived_metric_obj_ids = derived_metric_obj.generate_metric_ids()

        for ids_per_entity in supported_metric_ids_in_entities.values():
            if derived_metric_obj_ids.intersection(ids_per_entity) == derived_metric_obj_ids:
                found_derived_metrics.add(derived_metric_name)
                # If we find a match in ids in one entity, then skip checks across entities
                break
    return found_derived_metrics


def get_metrics(projects: Sequence[Project]) -> Sequence[MetricMeta]:
    assert projects

    metrics_meta = []
    metric_ids_in_entities = {}

    for metric_type in ("counter", "set", "distribution"):
        metric_ids_in_entities.setdefault(metric_type, set())
        for row in _get_metrics_for_entity(
            entity_key=METRIC_TYPE_TO_ENTITY[metric_type],
            projects=projects,
            org_id=projects[0].organization_id,
        ):
            metrics_meta.append(
                MetricMeta(
                    name=reverse_resolve(row["metric_id"]),
                    type=metric_type,
                    operations=AVAILABLE_OPERATIONS[METRIC_TYPE_TO_ENTITY[metric_type].value],
                    unit=None,  # snuba does not know the unit
                )
            )
            metric_ids_in_entities[metric_type].add(row["metric_id"])

    # In the previous loop, we find all available metric ids per entity with respect to the
    # projects filter, and so to figure out which derived metrics are supported for these
    # projects, we need to iterate over the list of derived metrics and generate the ids of
    # their constituent metrics. A derived metric should be added to the response list if its
    # metric ids are a subset of the metric ids in one of the entities i.e. Its an instance of
    # SingularEntityDerivedMetric.
    # ToDo(ahmed): When CompositeEntityDerivedMetrics are introduced we need to do these checks
    #  not on the instance of the CompositeEntityDerivedMetric but rather on its
    #  SingularEntityDerivedMetric constituents
    found_derived_metrics = get_available_derived_metrics(metric_ids_in_entities)
    for derived_metric_name in found_derived_metrics:
        derived_metric_obj = DERIVED_METRICS[derived_metric_name]
        metrics_meta.append(
            MetricMeta(
                name=derived_metric_obj.metric_name,
                type=derived_metric_obj.result_type,
                operations=derived_metric_obj.generate_available_operations(),
                unit=derived_metric_obj.unit,
            )
        )
    return sorted(metrics_meta, key=itemgetter("name"))


def _get_metrics_filter_ids(metric_names: Sequence[str]) -> Set[int]:
    """
    Returns a set of metric_ids that map to input metric names and raises an exception if
    metric cannot be resolved in the indexer
    """
    if not metric_names:
        return set()
    metric_ids = set()
    for name in metric_names:
        if name not in DERIVED_METRICS:
            metric_ids.add(indexer.resolve(name))
        else:
            metric_ids |= DERIVED_METRICS[name].generate_metric_ids()
    if None in metric_ids:
        # We are looking for tags that appear in all given metrics.
        # A tag cannot appear in a metric if the metric is not even indexed.
        raise MetricDoesNotExistInIndexer()
    return metric_ids


def _validate_requested_derived_metrics(
    metric_names: Sequence[str], supported_metric_ids_in_entities: Dict[MetricType, Sequence[int]]
) -> None:
    """
    Function that takes metric_names list and a mapping of entity to its metric ids, and ensures
    that all the derived metrics in the metric names list have constituent metric ids that are in
    the same entity. Otherwise, it raises an exception as that indicates that an instance of
    SingleEntityDerivedMetric was incorrectly setup with constituent metrics that span multiple
    entities
    """
    requested_derived_metrics = {
        metric_name for metric_name in metric_names if metric_name in DERIVED_METRICS
    }
    found_derived_metrics = get_available_derived_metrics(
        supported_metric_ids_in_entities, requested_derived_metrics
    )
    if requested_derived_metrics != found_derived_metrics:
        raise DerivedMetricParseException(
            f"The following metrics {requested_derived_metrics - found_derived_metrics} "
            f"cannot be computed from single entities. Please revise the definition of these "
            f"singular entity derived metrics"
        )


def get_tags(projects: Sequence[Project], metric_names: Optional[Sequence[str]]) -> Sequence[Tag]:
    """Get all metric tags for the given projects and metric_names"""
    assert projects

    try:
        metric_ids = _get_metrics_filter_ids(metric_names)
    except MetricDoesNotExistInIndexer:
        return []
    else:
        where = [Condition(Column("metric_id"), Op.IN, list(metric_ids))] if metric_ids else []

    tag_ids_per_metric_id = defaultdict(list)
    # This dictionary is required as a mapping from an entity to the ids available in it to
    # validate that constituent metrics of a SingleEntityDerivedMetric actually span a single
    # entity by validating that the ids of the constituent metrics all lie in the same entity
    supported_metric_ids_in_entities = {}

    for metric_type in ("counter", "set", "distribution"):
        supported_metric_ids_in_entities.setdefault(metric_type, [])

        entity_key = METRIC_TYPE_TO_ENTITY[metric_type]
        rows = run_metrics_query(
            entity_key=entity_key,
            select=[Column("metric_id"), Column("tags.key")],
            where=where,
            groupby=[Column("metric_id"), Column("tags.key")],
            referrer="snuba.metrics.meta.get_tags",
            projects=projects,
            org_id=projects[0].organization_id,
        )

        for row in rows:
            tag_ids_per_metric_id[row["metric_id"]].extend(row["tags.key"])
            supported_metric_ids_in_entities[metric_type].append(row["metric_id"])

        # If we are trying to find the tags for only one metric name, then no need to query other
        # entities once we find data for that metric_name in one of the entity
        if metric_names and len(metric_names) == 1 and rows:
            break

    # If we get not results back from snuba, then just return an empty set
    if not tag_ids_per_metric_id:
        return []

    tag_id_lists = tag_ids_per_metric_id.values()
    if metric_names:
        # If there are metric_ids that were not found in the dataset, then just return an []
        if metric_ids != set(tag_ids_per_metric_id.keys()):
            # This can occur for metric names that don't have an equivalent in the dataset.
            return []

        # At this point, we are sure that every metric_name/metric_id that was requested is
        # present in the dataset, and now we need to check that all derived metrics requested are
        # setup correctly
        _validate_requested_derived_metrics(
            metric_names=metric_names,
            supported_metric_ids_in_entities=supported_metric_ids_in_entities,
        )

        # Only return tags that occur in all metrics
        tag_ids = set.intersection(*map(set, tag_id_lists))
    else:
        tag_ids = {tag_id for ids in tag_id_lists for tag_id in ids}

    tags = [{"key": reverse_resolve(tag_id)} for tag_id in tag_ids]
    tags.sort(key=itemgetter("key"))

    return tags


def get_tag_values(
    projects: Sequence[Project], tag_name: str, metric_names: Optional[Sequence[str]]
) -> Sequence[TagValue]:
    """Get all known values for a specific tag"""
    assert projects

    tag_id = indexer.resolve(tag_name)
    if tag_id is None:
        raise InvalidParams

    try:
        metric_ids = _get_metrics_filter_ids(metric_names)
    except MetricDoesNotExistInIndexer:
        return []
    else:
        where = [Condition(Column("metric_id"), Op.IN, list(metric_ids))] if metric_ids else []

    tag_values = defaultdict(list)
    # This dictionary is required as a mapping from an entity to the ids available in it to
    # validate that constituent metrics of a SingleEntityDerivedMetric actually span a single
    # entity by validating that the ids of the constituent metrics all lie in the same entity
    supported_metric_ids_in_entities = {}

    column_name = f"tags[{tag_id}]"
    for metric_type in ("counter", "set", "distribution"):
        supported_metric_ids_in_entities.setdefault(metric_type, [])

        entity_key = METRIC_TYPE_TO_ENTITY[metric_type]
        rows = run_metrics_query(
            entity_key=entity_key,
            select=[Column("metric_id"), Column(column_name)],
            where=where,
            groupby=[Column("metric_id"), Column(column_name)],
            referrer="snuba.metrics.meta.get_tag_values",
            projects=projects,
            org_id=projects[0].organization_id,
        )
        for row in rows:
            value_id = row[column_name]
            supported_metric_ids_in_entities[metric_type].append(row["metric_id"])
            if value_id > 0:
                metric_id = row["metric_id"]
                tag_values[metric_id].append(value_id)

        # If we are trying to find the tag values for only one metric name, then no need to query
        # other entities once we find data for that metric_name in one of the entities
        if metric_names and len(metric_names) == 1 and rows:
            break

    value_id_lists = tag_values.values()
    if metric_names is not None:
        if metric_ids != set(tag_values.keys()):
            return []
        # At this point, we are sure that every metric_name/metric_id that was requested is
        # present in the dataset, and now we need to check that all derived metrics requested are
        # setup correctly
        _validate_requested_derived_metrics(
            metric_names=metric_names,
            supported_metric_ids_in_entities=supported_metric_ids_in_entities,
        )
        # Only return tags that occur in all metrics
        value_ids = set.intersection(*[set(ids) for ids in value_id_lists])
    else:
        value_ids = {value_id for ids in value_id_lists for value_id in ids}

    tags = [{"key": tag_name, "value": reverse_resolve(value_id)} for value_id in value_ids]
    tags.sort(key=lambda tag: (tag["key"], tag["value"]))

    return tags


def get_series(projects: Sequence[Project], query: QueryDefinition) -> dict:
    """Get time series for the given query"""
    intervals = list(get_intervals(query))
    results = {}

    if not query.groupby:
        # When there is no groupBy columns specified, we don't want to go through running an
        # initial query first to get the groups because there are no groups, and it becomes just
        # one group which is basically identical to eliminating the orderBy altogether
        query.orderby = None

    if query.orderby is not None:
        # ToDo(ahmed): Now that we have conditional aggregates as select statements, we might be
        #  able to shave off a query here. we only need the other queries for fields spanning other
        #  entities otherwise if all the fields belong to one entity then there is no need
        # There is a known limitation that since we make two queries, where we use the results of
        # the first query to filter down the results of the second query, so if the field used to
        # order by has no values for certain transactions for example in the case of the
        # performance table, we might end up showing less transactions than there actually are if
        # we choose to order by it. We are limited by the rows available for the field used in
        # the orderBy.

        # Multi-field select with order by functionality. Currently only supports the
        # performance table.
        original_query_fields = copy(query.fields)

        # The initial query has to contain only one field which is the same as the order by
        # field
        orderby_field = [key for key, value in query.fields.items() if value == query.orderby[0]][0]
        query.fields = {orderby_field: parse_field(orderby_field)}

        snuba_queries = SnubaQueryBuilder(projects, query).get_snuba_queries()
        if len(snuba_queries) > 1:
            # Currently accepting an order by field that spans multiple entities is not
            # supported, but it might change in the future. Even then, it might be better
            # handled on the snuba side of things
            raise InvalidParams(
                "Order by queries over multiple entities are not supported in "
                "multi-field select with order by clause queries"
            )

        try:
            # This query contains an order by clause, and so we are only interested in the
            # "totals" query
            initial_snuba_query = next(iter(snuba_queries.values()))["totals"]

            initial_query_results = raw_snql_query(
                initial_snuba_query, use_cache=False, referrer="api.metrics.totals.initial_query"
            )["data"]
        except StopIteration:
            # This can occur when requesting a list of derived metrics that are not have no data
            # for the passed projects
            initial_query_results = []

        # If we do not get any results from the first query, then there is no point in making
        # the second query
        if initial_query_results:
            # We no longer want the order by in the 2nd query because we already have the order of
            # the group by tags from the first query so we basically remove the order by columns,
            # and reset the query fields to the original fields because in the second query,
            # we want to query for all the metrics in the request api call
            query.orderby = None
            query.fields = original_query_fields

            snuba_queries = SnubaQueryBuilder(projects, query).get_snuba_queries()

            # Translate the groupby fields of the query into their tag keys because these fields
            # will be used to filter down and order the results of the 2nd query.
            # For example, (project_id, transaction) is translated to (project_id, tags[3])
            groupby_tags = tuple(
                resolve_tag_key(field) if field not in ALLOWED_GROUPBY_COLUMNS else field
                for field in query.groupby
            )

            # Dictionary that contains the conditions that are required to be added to the where
            # clause of the second query. In addition to filtering down on the tuple combination
            # of the fields in the group by columns, we need a separate condition for each of
            # the columns in the group by with their respective values so Clickhouse can
            # filter the results down before checking for the group by column combinations.
            ordered_tag_conditions = {
                col: list({data_elem[col] for data_elem in initial_query_results})
                for col in groupby_tags
            }
            ordered_tag_conditions[groupby_tags] = [
                tuple(data_elem[col] for col in groupby_tags) for data_elem in initial_query_results
            ]

            for entity, queries in snuba_queries.items():
                results.setdefault(entity, {})
                # This loop has constant time complexity as it will always have a maximum of
                # three queries corresponding to the three available entities
                # ["metrics_sets", "metrics_distributions", "metrics_counters"]
                for key, snuba_query in queries.items():
                    results[entity].setdefault(key, {"data": []})
                    # If query is grouped by project_id, then we should remove the original
                    # condition project_id cause it might be more relaxed than the project_id
                    # condition in the second query
                    where = []
                    for condition in snuba_query.where:
                        if not (
                            isinstance(condition.lhs, Column)
                            and condition.lhs.name == "project_id"
                            and "project_id" in groupby_tags
                        ):
                            where += [condition]

                    # Adds the conditions obtained from the previous query
                    for condition_key, condition_value in ordered_tag_conditions.items():
                        if not condition_key or not condition_value:
                            # Safeguard to prevent adding empty conditions to the where clause
                            continue

                        lhs_condition = (
                            Function("tuple", [Column(col) for col in condition_key])
                            if isinstance(condition_key, tuple)
                            else Column(condition_key)
                        )
                        where += [
                            Condition(lhs_condition, Op.IN, Function("tuple", condition_value))
                        ]
                    snuba_query = snuba_query.set_where(where)

                    # Set the limit of the second query to be the provided limits multiplied by
                    # the number of the metrics requested in the query in this specific entity
                    snuba_query = snuba_query.set_limit(
                        snuba_query.limit.limit * len(snuba_query.select)
                    )
                    snuba_query = snuba_query.set_offset(0)

                    snuba_query_res = raw_snql_query(
                        snuba_query, use_cache=False, referrer=f"api.metrics.{key}.second_query"
                    )
                    # Create a dictionary that has keys representing the ordered by tuples from the
                    # initial query, so that we are able to order it easily in the next code block
                    # If for example, we are grouping by (project_id, transaction) -> then this
                    # logic will output a dictionary that looks something like, where `tags[1]`
                    # represents transaction
                    # {
                    #     (3, 2): [{"metric_id": 4, "project_id": 3, "tags[1]": 2, "p50": [11.0]}],
                    #     (3, 3): [{"metric_id": 4, "project_id": 3, "tags[1]": 3, "p50": [5.0]}],
                    # }
                    snuba_query_data_dict = {}
                    for data_elem in snuba_query_res["data"]:
                        snuba_query_data_dict.setdefault(
                            tuple(data_elem[col] for col in groupby_tags), []
                        ).append(data_elem)

                    # Order the results according to the results of the initial query, so that when
                    # the results dict is passed on to `SnubaResultsConverter`, it comes out ordered
                    # Ordered conditions might for example look something like this
                    # {..., ('project_id', 'tags[1]'): [(3, 3), (3, 2)]}, then we end up with
                    # {
                    #     "totals": {
                    #         "data": [
                    #             {
                    #               "metric_id": 5, "project_id": 3, "tags[1]": 3, "count_unique": 5
                    #             },
                    #             {
                    #               "metric_id": 5, "project_id": 3, "tags[1]": 2, "count_unique": 1
                    #             },
                    #         ]
                    #     }
                    # }
                    for group_tuple in ordered_tag_conditions[groupby_tags]:
                        results[entity][key]["data"] += snuba_query_data_dict.get(group_tuple, [])
    else:
        snuba_queries = SnubaQueryBuilder(projects, query).get_snuba_queries()
        for entity, queries in snuba_queries.items():
            results.setdefault(entity, {})
            for key, snuba_query in queries.items():
                if snuba_query is None:
                    continue
                results[entity][key] = raw_snql_query(
                    snuba_query, use_cache=False, referrer=f"api.metrics.{key}"
                )

    assert projects
    converter = SnubaResultConverter(projects[0].organization_id, query, intervals, results)

    return {
        "start": query.start,
        "end": query.end,
        "query": query.query,
        "intervals": intervals,
        "groups": converter.translate_results(),
    }
