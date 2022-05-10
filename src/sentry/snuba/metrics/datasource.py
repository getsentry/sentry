"""
Module that gets both metadata and time series from Snuba.
For metadata, it fetch metrics metadata (metric names, tag names, tag values, ...) from snuba.
This is not intended for production use, but rather as an intermediate solution
until we have a proper metadata store set up. To keep things simple, and hopefully reasonably
efficient, we only look at the past 24 hours.
"""

__all__ = ("get_metrics", "get_tags", "get_tag_values", "get_series", "get_single_metric_info")
import logging
from collections import defaultdict, deque
from copy import copy
from dataclasses import replace
from operator import itemgetter
from typing import Any, Dict, Mapping, Optional, Sequence, Set, Tuple, Union

from snuba_sdk import Column, Condition, Function, Op, Request

from sentry.api.utils import InvalidParams
from sentry.models import Project
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.utils import resolve_tag_key, reverse_resolve
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.fields import run_metrics_query
from sentry.snuba.metrics.fields.base import get_derived_metrics, org_id_from_projects
from sentry.snuba.metrics.naming_layer.mapping import get_mri, get_public_name_from_mri
from sentry.snuba.metrics.query import QueryDefinition
from sentry.snuba.metrics.query_builder import (
    ALLOWED_GROUPBY_COLUMNS,
    SnubaQueryBuilder,
    SnubaResultConverter,
    get_intervals,
)
from sentry.snuba.metrics.utils import (
    AVAILABLE_OPERATIONS,
    METRIC_TYPE_TO_ENTITY,
    UNALLOWED_TAGS,
    DerivedMetricParseException,
    MetricDoesNotExistInIndexer,
    MetricMeta,
    MetricMetaWithTagKeys,
    MetricType,
    NotSupportedOverCompositeEntityException,
    Tag,
    TagValue,
)
from sentry.snuba.sessions_v2 import InvalidField
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)


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
    projects: Sequence[Project],
    supported_metric_ids_in_entities: Dict[MetricType, Sequence[int]],
) -> Set[str]:
    """
    Function that takes as input a dictionary of the available ids in each entity, and in turn
    goes through each derived metric, and returns back the set of the derived metrics that have
    data in the dataset in respect to the project filter. For instances of
    SingularEntityDerivedMetrics, it is enough to make sure that the constituent metric ids span
    a single entity and are present in the passed in dictionary. On the other hand, the available
    instances of CompositeEntityDerivedMetrics are computed from the found constituent instances
    of SingularEntityDerivedMetric
    """
    found_derived_metrics = set()
    composite_entity_derived_metrics = set()

    # Initially, we need all derived metrics to be able to support derived metrics that are not
    # private but might have private constituent metrics
    all_derived_metrics = get_derived_metrics(exclude_private=False)

    for derived_metric_mri, derived_metric_obj in all_derived_metrics.items():
        try:
            derived_metric_obj_ids = derived_metric_obj.generate_metric_ids(projects)
        except NotSupportedOverCompositeEntityException:
            # If we encounter a derived metric composed of constituents spanning multiple
            # entities then we store it in this set
            composite_entity_derived_metrics.add(derived_metric_obj.metric_mri)
            continue

        for ids_per_entity in supported_metric_ids_in_entities.values():
            if derived_metric_obj_ids.intersection(ids_per_entity) == derived_metric_obj_ids:
                found_derived_metrics.add(derived_metric_mri)
                # If we find a match in ids in one entity, then skip checks across entities
                break

    for composite_derived_metric_mri in composite_entity_derived_metrics:
        # We naively loop over singular entity derived metric constituents of a composite entity
        # derived metric and check if they have already been found and if that is the case,
        # then we add that instance of composite metric to the found derived metric.
        composite_derived_metric_obj = all_derived_metrics[composite_derived_metric_mri]
        single_entity_constituents = (
            composite_derived_metric_obj.naively_generate_singular_entity_constituents()
        )
        if single_entity_constituents.issubset(found_derived_metrics):
            found_derived_metrics.add(composite_derived_metric_obj.metric_mri)

    public_derived_metrics = set(get_derived_metrics(exclude_private=True).keys())
    return found_derived_metrics.intersection(public_derived_metrics)


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
            try:
                metrics_meta.append(
                    MetricMeta(
                        name=get_public_name_from_mri(reverse_resolve(row["metric_id"])),
                        type=metric_type,
                        operations=AVAILABLE_OPERATIONS[METRIC_TYPE_TO_ENTITY[metric_type].value],
                        unit=None,  # snuba does not know the unit
                    )
                )
            except InvalidField:
                # An instance of `InvalidField` exception is raised here when there is no reverse
                # mapping from MRI to public name because of the naming change
                logger.error("datasource.get_metrics.get_public_name_from_mri.error", exc_info=True)
                continue
            metric_ids_in_entities[metric_type].add(row["metric_id"])

    # In the previous loop, we find all available metric ids per entity with respect to the
    # projects filter, and so to figure out which derived metrics are supported for these
    # projects, we need to iterate over the list of derived metrics and generate the ids of
    # their constituent metrics. A derived metric should be added to the response list if its
    # metric ids are a subset of the metric ids in one of the entities i.e. Its an instance of
    # SingularEntityDerivedMetric.
    found_derived_metrics = get_available_derived_metrics(projects, metric_ids_in_entities)
    public_derived_metrics = get_derived_metrics(exclude_private=True)

    for derived_metric_mri in found_derived_metrics:
        derived_metric_obj = public_derived_metrics[derived_metric_mri]
        metrics_meta.append(
            MetricMeta(
                name=get_public_name_from_mri(derived_metric_obj.metric_mri),
                type=derived_metric_obj.result_type,
                operations=derived_metric_obj.generate_available_operations(),
                unit=derived_metric_obj.unit,
            )
        )
    return sorted(metrics_meta, key=itemgetter("name"))


def _get_metrics_filter_ids(projects: Sequence[Project], metric_mris: Sequence[str]) -> Set[int]:
    """
    Returns a set of metric_ids that map to input metric names and raises an exception if
    metric cannot be resolved in the indexer
    """
    if not metric_mris:
        return set()

    metric_ids = set()
    org_id = org_id_from_projects(projects)

    metric_mris_deque = deque(metric_mris)
    all_derived_metrics = get_derived_metrics(exclude_private=False)

    while metric_mris_deque:
        mri = metric_mris_deque.popleft()
        if mri not in all_derived_metrics:
            metric_ids.add(indexer.resolve(org_id, mri))
        else:
            derived_metric_obj = all_derived_metrics[mri]
            try:
                metric_ids |= derived_metric_obj.generate_metric_ids(projects)
            except NotSupportedOverCompositeEntityException:
                single_entity_constituents = (
                    derived_metric_obj.naively_generate_singular_entity_constituents()
                )
                metric_mris_deque.extend(single_entity_constituents)
    if None in metric_ids or -1 in metric_ids:
        # We are looking for tags that appear in all given metrics.
        # A tag cannot appear in a metric if the metric is not even indexed.
        raise MetricDoesNotExistInIndexer()
    return metric_ids


def _validate_requested_derived_metrics_in_input_metrics(
    projects: Sequence[Project],
    metric_mris: Sequence[str],
    supported_metric_ids_in_entities: Dict[MetricType, Sequence[int]],
) -> None:
    """
    Function that takes metric_mris list and a mapping of entity to its metric ids, and ensures
    that all the derived metrics in the metric names list have constituent metric ids that are in
    the same entity. Otherwise, it raises an exception as that indicates that an instance of
    SingleEntityDerivedMetric was incorrectly setup with constituent metrics that span multiple
    entities
    """
    public_derived_metrics = get_derived_metrics(exclude_private=True)
    requested_derived_metrics = {
        metric_mri for metric_mri in metric_mris if metric_mri in public_derived_metrics
    }
    found_derived_metrics = get_available_derived_metrics(
        projects, supported_metric_ids_in_entities
    )
    if not requested_derived_metrics.issubset(found_derived_metrics):
        raise DerivedMetricParseException(
            f"The following metrics {requested_derived_metrics - found_derived_metrics} "
            f"cannot be computed from single entities. Please revise the definition of these "
            f"singular entity derived metrics"
        )


def _fetch_tags_or_values_per_ids(
    projects: Sequence[Project],
    metric_names: Optional[Sequence[str]],
    referrer: str,
    column: str,
) -> Tuple[Union[Sequence[Tag], Sequence[TagValue]], Optional[str]]:
    """
    Function that takes as input projects, metric_names, and a column, and based on the column
    selection, either returns tags or tag values for the combination of projects and metric_names
    selected or in the case of no metric_names passed, returns basically all the tags or the tag
    values available for those projects. In addition, when exactly one metric name is passed in
    metric_names, then the type (i.e. mapping to the entity) is also returned
    """
    assert len({p.organization_id for p in projects}) == 1

    metric_mris = None
    if metric_names is not None:
        metric_mris = [get_mri(metric_name) for metric_name in metric_names]

        # ToDo(ahmed): Hack out private derived metrics logic
        private_derived_metrics = set(get_derived_metrics(exclude_private=False).keys()) - set(
            get_derived_metrics(exclude_private=True).keys()
        )
        if set(metric_mris).intersection(private_derived_metrics) != set():
            raise InvalidParams(f"Metric names {metric_names} do not exist")

    try:
        metric_ids = _get_metrics_filter_ids(projects=projects, metric_mris=metric_mris)
    except MetricDoesNotExistInIndexer:
        raise InvalidParams(
            f"Some or all of the metric names in {metric_names} do not exist in the indexer"
        )
    else:
        where = [Condition(Column("metric_id"), Op.IN, list(metric_ids))] if metric_ids else []

    tag_or_value_ids_per_metric_id = defaultdict(list)
    # This dictionary is required as a mapping from an entity to the ids available in it to
    # validate that constituent metrics of a SingleEntityDerivedMetric actually span a single
    # entity by validating that the ids of the constituent metrics all lie in the same entity
    supported_metric_ids_in_entities = {}

    for metric_type in ("counter", "set", "distribution"):

        entity_key = METRIC_TYPE_TO_ENTITY[metric_type]
        rows = run_metrics_query(
            entity_key=entity_key,
            select=[Column("metric_id"), Column(column)],
            where=where,
            groupby=[Column("metric_id"), Column(column)],
            referrer=referrer,
            projects=projects,
            org_id=projects[0].organization_id,
        )

        for row in rows:
            metric_id = row["metric_id"]
            if column.startswith("tags["):
                value_id = row[column]
                if value_id > 0:
                    tag_or_value_ids_per_metric_id[metric_id].append(value_id)
            else:
                tag_or_value_ids_per_metric_id[metric_id].extend(row[column])
            supported_metric_ids_in_entities.setdefault(metric_type, []).append(row["metric_id"])

    # If we get not results back from snuba, then raise an InvalidParams with an appropriate
    # error message
    if not tag_or_value_ids_per_metric_id:
        if metric_names:
            error_str = f"The following metrics {metric_names} do not exist in the dataset"
        else:
            error_str = "Dataset contains no metric data for your project selection"
        raise InvalidParams(error_str)

    tag_or_value_id_lists = tag_or_value_ids_per_metric_id.values()
    if metric_names:
        # If there are metric_ids that map to the metric_names provided as an arg that were not
        # found in the dataset, then we raise an instance of InvalidParams exception
        if metric_ids != set(tag_or_value_ids_per_metric_id.keys()):
            # This can occur for metric names that don't have an equivalent in the dataset.
            raise InvalidParams(
                f"Not all the requested metrics or the constituent metrics in {metric_names} have "
                f"data in the dataset"
            )

        # At this point, we are sure that every metric_name/metric_id that was requested is
        # present in the dataset, and now we need to check that for all derived metrics requested
        # (if any are requested) are setup correctly i.e. constituent of
        # SingularEntityDerivedMetric actually span a single entity
        _validate_requested_derived_metrics_in_input_metrics(
            projects,
            metric_mris=metric_mris,
            supported_metric_ids_in_entities=supported_metric_ids_in_entities,
        )

        # Only return tags/tag values that occur in all metrics
        tag_or_value_ids = set.intersection(*map(set, tag_or_value_id_lists))
    else:
        tag_or_value_ids = {tag_id for ids in tag_or_value_id_lists for tag_id in ids}

    if column.startswith("tags["):
        tag_id = column.split("tags[")[1].split("]")[0]
        tags_or_values = [
            {"key": reverse_resolve(int(tag_id)), "value": reverse_resolve(value_id)}
            for value_id in tag_or_value_ids
        ]
        tags_or_values.sort(key=lambda tag: (tag["key"], tag["value"]))
    else:
        tags_or_values = [
            {"key": reversed_tag}
            for tag_id in tag_or_value_ids
            if (reversed_tag := reverse_resolve(tag_id)) not in UNALLOWED_TAGS
        ]
        tags_or_values.sort(key=itemgetter("key"))

    if metric_names and len(metric_names) == 1:
        metric_type = list(supported_metric_ids_in_entities.keys())[0]
        return tags_or_values, metric_type
    return tags_or_values, None


def get_single_metric_info(projects: Sequence[Project], metric_name: str) -> MetricMetaWithTagKeys:
    assert projects

    tags, metric_type = _fetch_tags_or_values_per_ids(
        projects=projects,
        metric_names=[metric_name],
        column="tags.key",
        referrer="snuba.metrics.meta.get_single_metric",
    )
    entity_key = METRIC_TYPE_TO_ENTITY[metric_type]

    response_dict = {
        "name": metric_name,
        "type": metric_type,
        "operations": AVAILABLE_OPERATIONS[entity_key.value],
        "unit": None,
        "tags": tags,
    }

    metric_mri = get_mri(metric_name)
    public_derived_metrics = get_derived_metrics(exclude_private=True)
    if metric_mri in public_derived_metrics:
        derived_metric = public_derived_metrics[metric_mri]
        response_dict.update(
            {
                "operations": derived_metric.generate_available_operations(),
                "unit": derived_metric.unit,
                "type": derived_metric.result_type,
            }
        )
    return response_dict


def get_tags(projects: Sequence[Project], metric_names: Optional[Sequence[str]]) -> Sequence[Tag]:
    """Get all metric tags for the given projects and metric_names"""
    assert projects

    try:
        tags, _ = _fetch_tags_or_values_per_ids(
            projects=projects,
            metric_names=metric_names,
            column="tags.key",
            referrer="snuba.metrics.meta.get_tags",
        )
    except InvalidParams:
        return []
    return tags


def get_tag_values(
    projects: Sequence[Project], tag_name: str, metric_names: Optional[Sequence[str]]
) -> Sequence[TagValue]:
    """Get all known values for a specific tag"""
    assert projects

    org_id = org_id_from_projects(projects)
    tag_id = indexer.resolve(org_id, tag_name)

    if tag_name in UNALLOWED_TAGS:
        raise InvalidParams(f"Tag name {tag_name} is an unallowed tag")

    if tag_id is None:
        raise InvalidParams(f"Tag {tag_name} is not available in the indexer")

    try:
        tags, _ = _fetch_tags_or_values_per_ids(
            projects=projects,
            column=f"tags[{tag_id}]",
            metric_names=metric_names,
            referrer="snuba.metrics.meta.get_tag_values",
        )
    except InvalidParams:
        return []
    return tags


def get_series(projects: Sequence[Project], query: QueryDefinition) -> dict:
    """Get time series for the given query"""
    intervals = list(get_intervals(query.start, query.end, query.granularity.granularity))
    results = {}
    fields_in_entities = {}

    if not query.groupby:
        # When there is no groupBy columns specified, we don't want to go through running an
        # initial query first to get the groups because there are no groups, and it becomes just
        # one group which is basically identical to eliminating the orderBy altogether
        query = replace(query, orderby=None)

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
        original_select = copy(query.select)

        # The initial query has to contain only one field which is the same as the order by
        # field
        orderby_field = [field for field in query.select if field == query.orderby.field][0]
        query = replace(query, select=[orderby_field])

        snuba_queries, _ = SnubaQueryBuilder(projects, query).get_snuba_queries()
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

            request = Request(
                dataset=Dataset.Metrics.value, app_id="default", query=initial_snuba_query
            )
            initial_query_results = raw_snql_query(
                request, use_cache=False, referrer="api.metrics.totals.initial_query"
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
            query = replace(query, select=original_select, orderby=None)

            query_builder = SnubaQueryBuilder(projects, query)
            snuba_queries, fields_in_entities = query_builder.get_snuba_queries()

            # Translate the groupby fields of the query into their tag keys because these fields
            # will be used to filter down and order the results of the 2nd query.
            # For example, (project_id, transaction) is translated to (project_id, tags[3])
            groupby_tags = tuple(
                resolve_tag_key(query.org_id, field)
                if field not in ALLOWED_GROUPBY_COLUMNS
                else field
                for field in (query.groupby or [])
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
                            isinstance(condition, Condition)
                            and isinstance(condition.lhs, Column)
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

                    # The initial query already selected the "page", so reset the offset
                    snuba_query = snuba_query.set_offset(0)
                    request = Request(
                        dataset=Dataset.Metrics.value, app_id="default", query=snuba_query
                    )
                    snuba_query_res = raw_snql_query(
                        request, use_cache=False, referrer=f"api.metrics.{key}.second_query"
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
        snuba_queries, fields_in_entities = SnubaQueryBuilder(projects, query).get_snuba_queries()
        for entity, queries in snuba_queries.items():
            results.setdefault(entity, {})
            for key, snuba_query in queries.items():
                if snuba_query is None:
                    continue

                request = Request(
                    dataset=Dataset.Metrics.value, app_id="default", query=snuba_query
                )
                results[entity][key] = raw_snql_query(
                    request, use_cache=False, referrer=f"api.metrics.{key}"
                )

    assert projects
    converter = SnubaResultConverter(
        projects[0].organization_id, query, fields_in_entities, intervals, results
    )

    return {
        "start": query.start,
        "end": query.end,
        "intervals": intervals,
        "groups": converter.translate_results(),
    }
