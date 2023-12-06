import logging
import math
import random
from collections import namedtuple
from copy import deepcopy
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Sequence, Tuple

import sentry_sdk
from sentry_relay.consts import SPAN_STATUS_CODE_TO_NAME
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.function import Function
from typing_extensions import NotRequired, TypedDict

from sentry.discover.arithmetic import categorize_columns
from sentry.exceptions import InvalidSearchQuery
from sentry.models.group import Group
from sentry.search.events.builder import (
    HistogramQueryBuilder,
    QueryBuilder,
    TimeseriesQueryBuilder,
    TopEventsQueryBuilder,
)
from sentry.search.events.fields import (
    FIELD_ALIASES,
    get_function_alias,
    get_json_meta_type,
    is_function,
)
from sentry.search.events.types import HistogramParams, ParamsType, QueryBuilderConfig
from sentry.snuba.dataset import Dataset
from sentry.tagstore.base import TOP_VALUES_DEFAULT_LIMIT
from sentry.utils.dates import to_timestamp
from sentry.utils.math import nice_int
from sentry.utils.snuba import (
    SnubaTSResult,
    bulk_snql_query,
    get_array_column_alias,
    get_array_column_field,
    get_measurement_name,
    get_span_op_breakdown_name,
    is_measurement,
    is_span_op_breakdown,
    naiveify_datetime,
    resolve_column,
    to_naive_timestamp,
)

__all__ = (
    "PaginationResult",
    "InvalidSearchQuery",
    "query",
    "timeseries_query",
    "top_events_timeseries",
    "get_facets",
    "zerofill",
    "histogram_query",
    "check_multihistogram_fields",
)
DEFAULT_DATASET_REASON = "unchanged"


logger = logging.getLogger(__name__)

PreparedQuery = namedtuple("PreparedQuery", ["filter", "columns", "fields"])
PaginationResult = namedtuple("PaginationResult", ["next", "previous", "oldest", "latest"])
FacetResult = namedtuple("FacetResult", ["key", "value", "count"])


class EventsMeta(TypedDict):
    fields: Dict[str, str]
    datasetReason: NotRequired[str]
    isMetricsData: NotRequired[bool]
    isMetricsExtractedData: NotRequired[bool]


# When calling make build-spectacular-docs we hit this issue
# https://github.com/tfranzel/drf-spectacular/issues/1041
# This is a work around
EventsMeta.__annotations__["datasetReason"] = str
EventsMeta.__annotations__["isMetricsData"] = bool
EventsMeta.__annotations__["isMetricsExtractedData"] = bool


class EventsResponse(TypedDict):
    data: List[Dict[str, Any]]
    meta: EventsMeta


resolve_discover_column = resolve_column(Dataset.Discover)

OTHER_KEY = "Other"
TOP_KEYS_DEFAULT_LIMIT = 10


def is_real_column(col):
    """
    Return true if col corresponds to an actual column to be fetched
    (not an aggregate function or field alias)
    """
    if is_function(col):
        return False

    if col in FIELD_ALIASES:
        return False

    return True


def format_time(data, start, end, rollup, orderby):
    rv = []
    start = int(to_naive_timestamp(naiveify_datetime(start)) / rollup) * rollup
    end = (int(to_naive_timestamp(naiveify_datetime(end)) / rollup) * rollup) + rollup
    data_by_time = {}

    for obj in data:
        # This is needed for SnQL, and was originally done in utils.snuba.get_snuba_translators
        if isinstance(obj["time"], str):
            # `datetime.fromisoformat` is new in Python3.7 and before Python3.11, it is not a full
            # ISO 8601 parser. It is only the inverse function of `datetime.isoformat`, which is
            # the format returned by snuba. This is significantly faster when compared to other
            # parsers like `dateutil.parser.parse` and `datetime.strptime`.
            obj["time"] = int(to_timestamp(datetime.fromisoformat(obj["time"])))
        if obj["time"] in data_by_time:
            data_by_time[obj["time"]].append(obj)
        else:
            data_by_time[obj["time"]] = [obj]

    for key in range(start, end, rollup):
        if key in data_by_time and len(data_by_time[key]) > 0:
            rv.extend(data_by_time[key])

    if "-time" in orderby:
        return list(reversed(rv))

    return rv


def zerofill(data, start, end, rollup, orderby, time_col_name=None):
    rv = []
    start = int(to_naive_timestamp(naiveify_datetime(start)) / rollup) * rollup
    end = (int(to_naive_timestamp(naiveify_datetime(end)) / rollup) * rollup) + rollup
    data_by_time = {}

    for obj in data:
        if time_col_name and time_col_name in obj:
            obj["time"] = obj.pop(time_col_name)
        # This is needed for SnQL, and was originally done in utils.snuba.get_snuba_translators
        if isinstance(obj["time"], str):
            # `datetime.fromisoformat` is new in Python3.7 and before Python3.11, it is not a full
            # ISO 8601 parser. It is only the inverse function of `datetime.isoformat`, which is
            # the format returned by snuba. This is significantly faster when compared to other
            # parsers like `dateutil.parser.parse` and `datetime.strptime`.
            obj["time"] = int(to_timestamp(datetime.fromisoformat(obj["time"])))
        if obj["time"] in data_by_time:
            data_by_time[obj["time"]].append(obj)
        else:
            data_by_time[obj["time"]] = [obj]

    for key in range(start, end, rollup):
        if key in data_by_time and len(data_by_time[key]) > 0:
            rv.extend(data_by_time[key])
        else:
            rv.append({"time": key})

    if "-time" in orderby:
        return list(reversed(rv))

    return rv


def transform_tips(tips):
    return {
        "query": random.choice(list(tips["query"])) if tips["query"] else None,
        "columns": random.choice(list(tips["columns"])) if tips["columns"] else None,
    }


def query(
    selected_columns,
    query,
    params,
    snuba_params=None,
    equations=None,
    orderby=None,
    offset=None,
    limit=50,
    referrer=None,
    auto_fields=False,
    auto_aggregations=False,
    include_equation_fields=False,
    allow_metric_aggregates=False,
    use_aggregate_conditions=False,
    conditions=None,
    functions_acl=None,
    transform_alias_to_input_format=False,
    sample=None,
    has_metrics=False,
    use_metrics_layer=False,
    skip_tag_resolution=False,
    extra_columns=None,
    on_demand_metrics_enabled=False,
    on_demand_metrics_type=None,
) -> EventsResponse:
    """
    High-level API for doing arbitrary user queries against events.

    This function operates on the Discover public event schema and
    virtual fields/aggregate functions for selected columns and
    conditions are supported through this function.

    The resulting list will have all internal field names mapped
    back into their public schema names.

    selected_columns (Sequence[str]) List of public aliases to fetch.
    query (str) Filter query string to create conditions from.
    params (Dict[str, str]) Filtering parameters with start, end, project_id, environment
    equations (Sequence[str]) List of equations to calculate for the query
    orderby (None|str|Sequence[str]) The field to order results by.
    offset (None|int) The record offset to read.
    limit (int) The number of records to fetch.
    referrer (str|None) A referrer string to help locate the origin of this query.
    auto_fields (bool) Set to true to have project + eventid fields automatically added.
    auto_aggregations (bool) Whether aggregates should be added automatically if they're used
                    in conditions, and there's at least one aggregate already.
    include_equation_fields (bool) Whether fields should be added automatically if they're used in
                    equations
    allow_metric_aggregates (bool) Ignored here, only used in metric enhanced performance
    use_aggregate_conditions (bool) Set to true if aggregates conditions should be used at all.
    conditions (Sequence[Condition]) List of conditions that are passed directly to snuba without
                    any additional processing.
    transform_alias_to_input_format (bool) Whether aggregate columns should be returned in the originally
                                requested function format.
    sample (float) The sample rate to run the query with
    """
    if not selected_columns:
        raise InvalidSearchQuery("No columns selected")

    builder = QueryBuilder(
        Dataset.Discover,
        params,
        snuba_params=snuba_params,
        query=query,
        selected_columns=selected_columns,
        equations=equations,
        orderby=orderby,
        limit=limit,
        offset=offset,
        sample_rate=sample,
        config=QueryBuilderConfig(
            auto_fields=auto_fields,
            auto_aggregations=auto_aggregations,
            use_aggregate_conditions=use_aggregate_conditions,
            functions_acl=functions_acl,
            equation_config={"auto_add": include_equation_fields},
            has_metrics=has_metrics,
            transform_alias_to_input_format=transform_alias_to_input_format,
            skip_tag_resolution=skip_tag_resolution,
        ),
    )
    if conditions is not None:
        builder.add_conditions(conditions)
    if extra_columns is not None:
        builder.columns.extend(extra_columns)

    result = builder.process_results(builder.run_query(referrer))
    result["meta"]["tips"] = transform_tips(builder.tips)
    return result


def timeseries_query(
    selected_columns: Sequence[str],
    query: str,
    params: Dict[str, Any],
    rollup: int,
    referrer: Optional[str] = None,
    zerofill_results: bool = True,
    comparison_delta: Optional[timedelta] = None,
    functions_acl: Optional[List[str]] = None,
    allow_metric_aggregates=False,
    has_metrics=False,
    use_metrics_layer=False,
    on_demand_metrics_enabled=False,
    on_demand_metrics_type=None,
):
    """
    High-level API for doing arbitrary user timeseries queries against events.

    This function operates on the public event schema and
    virtual fields/aggregate functions for selected columns and
    conditions are supported through this function.

    This function is intended to only get timeseries based
    results and thus requires the `rollup` parameter.

    Returns a SnubaTSResult object that has been zerofilled in
    case of gaps.

    selected_columns (Sequence[str]) List of public aliases to fetch.
    query (str) Filter query string to create conditions from.
    params (Dict[str, str]) Filtering parameters with start, end, project_id, environment,
    rollup (int) The bucket width in seconds
    referrer (str|None) A referrer string to help locate the origin of this query.
    comparison_delta: A timedelta used to convert this into a comparison query. We make a second
    query time-shifted back by comparison_delta, and compare the results to get the % change for each
    time bucket. Requires that we only pass
    allow_metric_aggregates (bool) Ignored here, only used in metric enhanced performance
    """
    with sentry_sdk.start_span(op="discover.discover", description="timeseries.filter_transform"):
        equations, columns = categorize_columns(selected_columns)
        base_builder = TimeseriesQueryBuilder(
            Dataset.Discover,
            params,
            rollup,
            query=query,
            selected_columns=columns,
            equations=equations,
            config=QueryBuilderConfig(
                functions_acl=functions_acl,
                has_metrics=has_metrics,
            ),
        )
        query_list = [base_builder]
        if comparison_delta:
            if len(base_builder.aggregates) != 1:
                raise InvalidSearchQuery("Only one column can be selected for comparison queries")
            comp_query_params = deepcopy(params)
            comp_query_params["start"] -= comparison_delta
            comp_query_params["end"] -= comparison_delta
            comparison_builder = TimeseriesQueryBuilder(
                Dataset.Discover,
                comp_query_params,
                rollup,
                query=query,
                selected_columns=columns,
                equations=equations,
            )
            query_list.append(comparison_builder)

        query_results = bulk_snql_query([query.get_snql_query() for query in query_list], referrer)

    with sentry_sdk.start_span(op="discover.discover", description="timeseries.transform_results"):
        results = []
        for snql_query, result in zip(query_list, query_results):
            results.append(
                {
                    "data": zerofill(
                        result["data"],
                        snql_query.params.start,
                        snql_query.params.end,
                        rollup,
                        "time",
                    )
                    if zerofill_results
                    else result["data"],
                    "meta": result["meta"],
                }
            )

    if len(results) == 2 and comparison_delta:
        col_name = base_builder.aggregates[0].alias
        # If we have two sets of results then we're doing a comparison queries. Divide the primary
        # results by the comparison results.
        for result, cmp_result in zip(results[0]["data"], results[1]["data"]):
            cmp_result_val = cmp_result.get(col_name, 0)
            result["comparisonCount"] = cmp_result_val

    result = results[0]

    return SnubaTSResult(
        {
            "data": result["data"],
            "meta": {
                "fields": {
                    value["name"]: get_json_meta_type(
                        value["name"], value.get("type"), base_builder
                    )
                    for value in result["meta"]
                }
            },
        },
        params["start"],
        params["end"],
        rollup,
    )


def create_result_key(result_row, fields, issues) -> str:
    values = []
    for field in fields:
        if field == "issue.id":
            issue_id = issues.get(result_row["issue.id"], "unknown")
            if issue_id is None:
                issue_id = "unknown"
            values.append(issue_id)
        elif field == "transaction.status":
            values.append(SPAN_STATUS_CODE_TO_NAME.get(result_row[field], "unknown"))
        else:
            value = result_row.get(field)
            if isinstance(value, list):
                if len(value) > 0:
                    value = value[-1]
                else:
                    value = ""
            values.append(str(value))
    result = ",".join(values)
    # If the result would be identical to the other key, include the field name
    # only need the first field since this would only happen with a single field
    if result == OTHER_KEY:
        result = f"{result} ({fields[0]})"
    return result


def top_events_timeseries(
    timeseries_columns,
    selected_columns,
    user_query,
    params,
    orderby,
    rollup,
    limit,
    organization,
    equations=None,
    referrer=None,
    top_events=None,
    allow_empty=True,
    zerofill_results=True,
    include_other=False,
    functions_acl=None,
    on_demand_metrics_enabled: bool = False,
    on_demand_metrics_type=None,
):
    """
    High-level API for doing arbitrary user timeseries queries for a limited number of top events

    Returns a dictionary of SnubaTSResult objects that have been zerofilled in
    case of gaps. Each value of the dictionary should match the result of a timeseries query

    timeseries_columns (Sequence[str]) List of public aliases to fetch for the timeseries query,
                    usually matches the y-axis of the graph
    selected_columns (Sequence[str]) List of public aliases to fetch for the events query,
                    this is to determine what the top events are
    user_query (str) Filter query string to create conditions from. needs to be user_query
                    to not conflict with the function query
    params (Dict[str, str]) Filtering parameters with start, end, project_id, environment,
    orderby (Sequence[str]) The fields to order results by.
    rollup (int) The bucket width in seconds
    limit (int) The number of events to get timeseries for
    organization (Organization) Used to map group ids to short ids
    referrer (str|None) A referrer string to help locate the origin of this query.
    top_events (dict|None) A dictionary with a 'data' key containing a list of dictionaries that
                    represent the top events matching the query. Useful when you have found
                    the top events earlier and want to save a query.
    """
    if top_events is None:
        with sentry_sdk.start_span(op="discover.discover", description="top_events.fetch_events"):
            top_events = query(
                selected_columns,
                query=user_query,
                params=params,
                equations=equations,
                orderby=orderby,
                limit=limit,
                referrer=referrer,
                auto_aggregations=True,
                use_aggregate_conditions=True,
                include_equation_fields=True,
                skip_tag_resolution=True,
            )

    top_events_builder = TopEventsQueryBuilder(
        Dataset.Discover,
        params,
        rollup,
        top_events["data"],
        other=False,
        query=user_query,
        selected_columns=selected_columns,
        timeseries_columns=timeseries_columns,
        equations=equations,
        config=QueryBuilderConfig(
            functions_acl=functions_acl,
            skip_tag_resolution=True,
        ),
    )
    if len(top_events["data"]) == limit and include_other:
        other_events_builder = TopEventsQueryBuilder(
            Dataset.Discover,
            params,
            rollup,
            top_events["data"],
            other=True,
            query=user_query,
            selected_columns=selected_columns,
            timeseries_columns=timeseries_columns,
            equations=equations,
        )
        result, other_result = bulk_snql_query(
            [top_events_builder.get_snql_query(), other_events_builder.get_snql_query()],
            referrer=referrer,
        )
    else:
        result = top_events_builder.run_query(referrer)
        other_result = {"data": []}
    if (
        not allow_empty
        and not len(result.get("data", []))
        and not len(other_result.get("data", []))
    ):
        return SnubaTSResult(
            {
                "data": zerofill([], params["start"], params["end"], rollup, "time")
                if zerofill_results
                else [],
            },
            params["start"],
            params["end"],
            rollup,
        )
    with sentry_sdk.start_span(
        op="discover.discover", description="top_events.transform_results"
    ) as span:
        span.set_data("result_count", len(result.get("data", [])))
        result = top_events_builder.process_results(result)

        issues = {}
        if "issue" in selected_columns:
            issues = Group.objects.get_issues_mapping(
                {event["issue.id"] for event in top_events["data"]},
                params["project_id"],
                organization,
            )
        translated_groupby = top_events_builder.translated_groupby

        results = (
            {OTHER_KEY: {"order": limit, "data": other_result["data"]}}
            if len(other_result.get("data", []))
            else {}
        )
        # Using the top events add the order to the results
        for index, item in enumerate(top_events["data"]):
            result_key = create_result_key(item, translated_groupby, issues)
            results[result_key] = {"order": index, "data": []}
        for row in result["data"]:
            result_key = create_result_key(row, translated_groupby, issues)
            if result_key in results:
                results[result_key]["data"].append(row)
            else:
                logger.warning(
                    "discover.top-events.timeseries.key-mismatch",
                    extra={"result_key": result_key, "top_event_keys": list(results.keys())},
                )
        for key, item in results.items():
            results[key] = SnubaTSResult(
                {
                    "data": zerofill(item["data"], params["start"], params["end"], rollup, "time")
                    if zerofill_results
                    else item["data"],
                    "order": item["order"],
                },
                params["start"],
                params["end"],
                rollup,
            )

    return results


def get_id(result):
    if result:
        return result[1]


def get_facets(
    query: str,
    params: ParamsType,
    referrer: str,
    per_page: Optional[int] = TOP_KEYS_DEFAULT_LIMIT,
    cursor: Optional[int] = 0,
):
    """
    High-level API for getting 'facet map' results.

    Facets are high frequency tags and attribute results that
    can be used to further refine user queries. When many projects
    are requested sampling will be enabled to help keep response times low.

    query (str) Filter query string to create conditions from.
    params (Dict[str, str]) Filtering parameters with start, end, project_id, environment
    referrer (str) A referrer string to help locate the origin of this query.
    per_page (int) The number of records to fetch.
    cursor (int) The number of records to skip.

    Returns Sequence[FacetResult]
    """
    sample = len(params["project_id"]) > 2
    fetch_projects = len(params.get("project_id", [])) > 1

    with sentry_sdk.start_span(op="discover.discover", description="facets.frequent_tags"):
        key_name_builder = QueryBuilder(
            Dataset.Discover,
            params,
            query=query,
            selected_columns=["tags_key", "count()"],
            orderby=["-count()", "tags_key"],
            limit=per_page,
            # Remove one from the cursor because if we fetch_projects then
            # a result is popped off and replaced with projects, offsetting
            # the pagination on subsequent pages
            offset=cursor - 1 if fetch_projects and cursor > 0 else cursor,
            turbo=sample,
        )
        key_names = key_name_builder.run_query(referrer)
        # Sampling keys for multi-project results as we don't need accuracy
        # with that much data.
        top_tags = [r["tags_key"] for r in key_names["data"]]
        if not top_tags:
            return []

    # TODO: Make the sampling rate scale based on the result size and scaling factor in
    # sentry.options. To test the lowest acceptable sampling rate, we use 0.1 which
    # is equivalent to turbo. We don't use turbo though as we need to re-scale data, and
    # using turbo could cause results to be wrong if the value of turbo is changed in snuba.
    sample_rate = 0.1 if (key_names["data"][0]["count"] > 10000) else None
    # Rescale the results if we're sampling
    multiplier = 1 / sample_rate if sample_rate is not None else 1

    if fetch_projects and len(top_tags) == per_page and cursor == 0:
        top_tags.pop()

    top_tag_results = []
    project_results = []
    # Inject project data on the first page if multiple projects are selected
    if fetch_projects and cursor == 0:
        with sentry_sdk.start_span(op="discover.discover", description="facets.projects"):
            project_value_builder = QueryBuilder(
                Dataset.Discover,
                params,
                query=query,
                selected_columns=["count()", "project_id"],
                orderby=["-count()"],
                # Ensures Snuba will not apply FINAL
                turbo=sample_rate is not None,
                sample_rate=sample_rate,
            )
            project_values = project_value_builder.run_query(referrer=referrer)
            project_results.extend(
                [
                    FacetResult("project", r["project_id"], int(r["count"]) * multiplier)
                    for r in project_values["data"]
                ]
            )

    # Get tag counts for our top tags. Fetching them individually
    # allows snuba to leverage promoted tags better and enables us to get
    # the value count we want.
    individual_tags = []
    aggregate_tags = []
    for i, tag in enumerate(top_tags):
        if tag == "environment":
            # Add here tags that you want to be individual
            individual_tags.append(tag)
        elif i >= len(top_tags) - per_page:
            aggregate_tags.append(tag)
        else:
            individual_tags.append(tag)

    with sentry_sdk.start_span(
        op="discover.discover", description="facets.individual_tags"
    ) as span:
        span.set_data("tag_count", len(individual_tags))
        for tag_name in individual_tags:
            tag = f"tags[{tag_name}]"
            tag_value_builder = QueryBuilder(
                Dataset.Discover,
                params,
                query=query,
                selected_columns=["count()", tag],
                orderby=["-count()"],
                limit=TOP_VALUES_DEFAULT_LIMIT,
                # Ensures Snuba will not apply FINAL
                turbo=sample_rate is not None,
                sample_rate=sample_rate,
            )
            tag_values = tag_value_builder.run_query(referrer)
            top_tag_results.extend(
                [
                    FacetResult(tag_name, r[tag], int(r["count"]) * multiplier)
                    for r in tag_values["data"]
                ]
            )

    if aggregate_tags:
        with sentry_sdk.start_span(op="discover.discover", description="facets.aggregate_tags"):
            aggregate_value_builder = QueryBuilder(
                Dataset.Discover,
                params,
                query=(query if query is not None else "")
                + f" tags_key:[{','.join(aggregate_tags)}]",
                selected_columns=["count()", "tags_key", "tags_value"],
                orderby=["tags_key", "-count()"],
                limitby=("tags_key", TOP_VALUES_DEFAULT_LIMIT),
                # Increase the limit to ensure we get results for each tag
                limit=len(aggregate_tags) * TOP_VALUES_DEFAULT_LIMIT,
                # Ensures Snuba will not apply FINAL
                turbo=sample_rate is not None,
                sample_rate=sample_rate,
            )
            aggregate_values = aggregate_value_builder.run_query(referrer)
            top_tag_results.extend(
                [
                    FacetResult(r["tags_key"], r["tags_value"], int(r["count"]) * multiplier)
                    for r in aggregate_values["data"]
                ]
            )

    # Need to cast tuple values to str since the value might be None
    # Reverse sort the count so the highest values show up first
    top_tag_results = sorted(
        top_tag_results, key=lambda result: (str(result.key), -result.count, str(result.value))
    )

    # Ensure projects are at the beginning of the results so they are not
    # truncated by the paginator
    return [*project_results, *top_tag_results]


def spans_histogram_query(
    span,
    user_query,
    params,
    num_buckets,
    precision=0,
    min_value=None,
    max_value=None,
    data_filter=None,
    referrer=None,
    group_by=None,
    order_by=None,
    limit_by=None,
    extra_condition=None,
    normalize_results=True,
    use_metrics_layer=False,
    on_demand_metrics_enabled=False,
    on_demand_metrics_type=None,
):
    """
    API for generating histograms for span exclusive time.

    :param [str] span: A span for which you want to generate histograms for. A span should passed in the following format - "{span_op}:{span_group}"
    :param str user_query: Filter query string to create conditions from.
    :param {str: str} params: Filtering parameters with start, end, project_id, environment
    :param int num_buckets: The number of buckets the histogram should contain.
    :param int precision: The number of decimal places to preserve, default 0.
    :param float min_value: The minimum value allowed to be in the histogram.
        If left unspecified, it is queried using `user_query` and `params`.
    :param float max_value: The maximum value allowed to be in the histogram.
        If left unspecified, it is queried using `user_query` and `params`.
    :param str data_filter: Indicate the filter strategy to be applied to the data.
    :param [str] group_by: Allows additional grouping to serve multifacet histograms.
    :param [str] order_by: Allows additional ordering within each alias to serve multifacet histograms.
    :param [str] limit_by: Allows limiting within a group when serving multifacet histograms.
    :param [Condition] extra_condition: Adds any additional conditions to the histogram query
    :param bool normalize_results: Indicate whether to normalize the results by column into bins.
    """
    multiplier = int(10**precision)
    if max_value is not None:
        # We want the specified max_value to be exclusive, and the queried max_value
        # to be inclusive. So we adjust the specified max_value using the multiplier.
        max_value -= 0.1 / multiplier

    min_value, max_value = find_span_histogram_min_max(
        span, min_value, max_value, user_query, params, data_filter
    )

    key_column = None
    field_names = []
    histogram_rows = None

    histogram_params = find_histogram_params(num_buckets, min_value, max_value, multiplier)
    histogram_column = get_span_histogram_column(span, histogram_params)

    builder = HistogramQueryBuilder(
        num_buckets,
        histogram_column,
        histogram_rows,
        histogram_params,
        key_column,
        field_names,
        group_by,
        # Arguments for QueryBuilder
        Dataset.Discover,
        params,
        query=user_query,
        selected_columns=[""],
        orderby=order_by,
        limitby=limit_by,
    )
    if extra_condition is not None:
        builder.add_conditions(extra_condition)

    builder.add_conditions(
        [
            Condition(Function("has", [builder.column("spans_op"), span.op]), Op.EQ, 1),
            Condition(Function("has", [builder.column("spans_group"), span.group]), Op.EQ, 1),
        ]
    )
    results = builder.run_query(referrer)

    if not normalize_results:
        return results

    return normalize_span_histogram_results(span, histogram_params, results)


def histogram_query(
    fields,
    user_query,
    params,
    num_buckets,
    precision=0,
    min_value=None,
    max_value=None,
    data_filter=None,
    referrer=None,
    group_by=None,
    order_by=None,
    limit_by=None,
    histogram_rows=None,
    extra_conditions=None,
    normalize_results=True,
    use_metrics_layer=False,
    on_demand_metrics_enabled=False,
    on_demand_metrics_type=None,
):
    """
    API for generating histograms for numeric columns.

    A multihistogram is possible only if the columns are all array columns.
    Array columns are columns whose values are nested arrays.
    Measurements and span op breakdowns are examples of array columns.
    The resulting histograms will have their bins aligned.

    :param [str] fields: The list of fields for which you want to generate histograms for.
    :param str user_query: Filter query string to create conditions from.
    :param {str: str} params: Filtering parameters with start, end, project_id, environment
    :param int num_buckets: The number of buckets the histogram should contain.
    :param int precision: The number of decimal places to preserve, default 0.
    :param float min_value: The minimum value allowed to be in the histogram.
        If left unspecified, it is queried using `user_query` and `params`.
    :param float max_value: The maximum value allowed to be in the histogram.
        If left unspecified, it is queried using `user_query` and `params`.
    :param str data_filter: Indicate the filter strategy to be applied to the data.
    :param [str] group_by: Allows additional grouping to serve multifacet histograms.
    :param [str] order_by: Allows additional ordering within each alias to serve multifacet histograms.
    :param [str] limit_by: Allows limiting within a group when serving multifacet histograms.
    :param int histogram_rows: Used to modify the limit when fetching multiple rows of buckets (performance facets).
    :param [Condition] extra_conditions: Adds any additional conditions to the histogram query that aren't received from params.
    :param bool normalize_results: Indicate whether to normalize the results by column into bins.
    """

    multiplier = int(10**precision)
    if max_value is not None:
        # We want the specified max_value to be exclusive, and the queried max_value
        # to be inclusive. So we adjust the specified max_value using the multiplier.
        max_value -= 0.1 / multiplier

    min_value, max_value = find_histogram_min_max(
        fields,
        min_value,
        max_value,
        user_query,
        params,
        data_filter,
    )

    key_column = None
    array_column = None
    field_names = None
    if len(fields) > 1:
        array_column = check_multihistogram_fields(fields)
        if array_column == "measurements":
            key_column = "array_join(measurements_key)"
            histogram_function = get_measurement_name
        elif array_column == "span_op_breakdowns":
            key_column = "array_join(span_op_breakdowns_key)"
            histogram_function = get_span_op_breakdown_name
        else:
            raise InvalidSearchQuery(
                "multihistogram expected either all measurements or all breakdowns"
            )

        field_names = [histogram_function(field) for field in fields]
    histogram_params = find_histogram_params(num_buckets, min_value, max_value, multiplier)
    histogram_column = get_histogram_column(fields, key_column, histogram_params, array_column)
    if min_value is None or max_value is None:
        return normalize_histogram_results(
            fields, key_column, histogram_params, {"data": []}, array_column
        )

    builder = HistogramQueryBuilder(
        num_buckets,
        histogram_column,
        histogram_rows,
        histogram_params,
        key_column,
        field_names,
        group_by,
        # Arguments for QueryBuilder
        Dataset.Discover,
        params,
        query=user_query,
        selected_columns=fields,
        orderby=order_by,
        limitby=limit_by,
    )
    if extra_conditions is not None:
        builder.add_conditions(extra_conditions)
    results = builder.process_results(builder.run_query(referrer))

    if not normalize_results:
        return results

    return normalize_histogram_results(fields, key_column, histogram_params, results, array_column)


def get_span_histogram_column(span, histogram_params):
    """
    Generate the histogram column string for spans.

    :param [Span] span: The span for which you want to generate the histograms for.
    :param HistogramParams histogram_params: The histogram parameters used.
    """
    span_op = span.op
    span_group = span.group
    return f'spans_histogram("{span_op}", {span_group}, {histogram_params.bucket_size:d}, {histogram_params.start_offset:d}, {histogram_params.multiplier:d})'


def get_histogram_column(fields, key_column, histogram_params, array_column):
    """
    Generate the histogram column string.

    :param [str] fields: The list of fields for which you want to generate the histograms for.
    :param str key_column: The column for the key name. This is only set when generating a
        multihistogram of array values. Otherwise, it should be `None`.
    :param HistogramParams histogram_params: The histogram parameters used.
    :param str array_column: Array column prefix
    """
    field = fields[0] if key_column is None else f"{array_column}_value"
    return f"histogram({field}, {histogram_params.bucket_size:d}, {histogram_params.start_offset:d}, {histogram_params.multiplier:d})"


def find_histogram_params(num_buckets, min_value, max_value, multiplier):
    """
    Compute the parameters to use for the histogram. Using the provided
    arguments, ensure that the generated histogram encapsulates the desired range.

    :param int num_buckets: The number of buckets the histogram should contain.
    :param float min_value: The minimum value allowed to be in the histogram inclusive.
    :param float max_value: The maximum value allowed to be in the histogram inclusive.
    :param int multiplier: The multiplier we should use to preserve the desired precision.
    """

    scaled_min = 0 if min_value is None else multiplier * min_value
    scaled_max = 0 if max_value is None else multiplier * max_value

    # align the first bin with the minimum value
    start_offset = int(scaled_min)

    # finding the bounds might result in None if there isn't sufficient data
    if min_value is None or max_value is None:
        return HistogramParams(num_buckets, 1, start_offset, multiplier)

    bucket_size = nice_int((scaled_max - scaled_min) / float(num_buckets))

    if bucket_size == 0:
        bucket_size = 1

    # adjust the first bin to a nice value
    start_offset = int(scaled_min / bucket_size) * bucket_size

    # Sometimes the max value lies on the bucket boundary, and since the end
    # of the bucket is exclusive, it gets excluded. To account for that, we
    # increase the width of the buckets to cover the max value.
    if start_offset + num_buckets * bucket_size <= scaled_max:
        bucket_size = nice_int(bucket_size + 1)

    # compute the bin for max value and adjust the number of buckets accordingly
    # to minimize unnecessary empty bins at the tail
    last_bin = int((scaled_max - start_offset) / bucket_size) * bucket_size + start_offset
    num_buckets = (last_bin - start_offset) // bucket_size + 1

    return HistogramParams(num_buckets, bucket_size, start_offset, multiplier)


def find_span_histogram_min_max(span, min_value, max_value, user_query, params, data_filter=None):
    """
    Find the min/max value of the specified span. If either min/max is already
    specified, it will be used and not queried for.

    :param [Span] span: A span for which you want to generate the histograms for.
    :param float min_value: The minimum value allowed to be in the histogram.
        If left unspecified, it is queried using `user_query` and `params`.
    :param float max_value: The maximum value allowed to be in the histogram.
        If left unspecified, it is queried using `user_query` and `params`.
    :param str user_query: Filter query string to create conditions from.
    :param {str: str} params: Filtering parameters with start, end, project_id, environment
    :param str data_filter: Indicate the filter strategy to be applied to the data.
    """
    if min_value is not None and max_value is not None:
        return min_value, max_value

    selected_columns = []
    min_column = ""
    max_column = ""
    outlier_lower_fence = ""
    outlier_upper_fence = ""
    if min_value is None:
        min_column = f'fn_span_exclusive_time("{span.op}", {span.group}, min)'
        selected_columns.append(min_column)
    if max_value is None:
        max_column = f'fn_span_exclusive_time("{span.op}", {span.group}, max)'
        selected_columns.append(max_column)
    if data_filter == "exclude_outliers":
        outlier_lower_fence = f'fn_span_exclusive_time("{span.op}", {span.group}, quantile(0.25))'
        outlier_upper_fence = f'fn_span_exclusive_time("{span.op}", {span.group}, quantile(0.75))'
        selected_columns.append(outlier_lower_fence)
        selected_columns.append(outlier_upper_fence)

    results = query(
        selected_columns=selected_columns,
        query=user_query,
        params=params,
        limit=1,
        referrer="api.organization-spans-histogram-min-max",
        functions_acl=["fn_span_exclusive_time"],
    )

    data = results.get("data")

    # there should be exactly 1 row in the results, but if something went wrong here,
    # we force the min/max to be None to coerce an empty histogram
    if data is None or len(data) != 1:
        return None, None

    row = data[0]

    if min_value is None:
        calculated_min_value = row[get_function_alias(min_column)]
        min_value = calculated_min_value if calculated_min_value else None
        if max_value is not None and min_value is not None:
            # max_value was provided by the user, and min_value was queried.
            # If min_value > max_value, then we adjust min_value with respect to
            # max_value. The rationale is that if the user provided max_value,
            # then any and all data above max_value should be ignored since it is
            # and upper bound.
            min_value = min([max_value, min_value])

    if max_value is None:
        calculated_max_value = row[get_function_alias(max_column)]
        max_value = calculated_max_value if calculated_max_value else None

        max_fence_value = None
        if data_filter == "exclude_outliers":
            outlier_lower_fence_alias = get_function_alias(outlier_lower_fence)
            outlier_upper_fence_alias = get_function_alias(outlier_upper_fence)

            first_quartile = row[outlier_lower_fence_alias]
            third_quartile = row[outlier_upper_fence_alias]

            if (
                first_quartile is not None
                or third_quartile is not None
                or not math.isnan(first_quartile)
                or not math.isnan(third_quartile)
            ):
                interquartile_range = abs(third_quartile - first_quartile)
                upper_outer_fence = third_quartile + 3 * interquartile_range
                max_fence_value = upper_outer_fence

        candidates = [max_fence_value, max_value]
        candidates = list(filter(lambda v: v is not None, candidates))
        max_value = min(candidates) if candidates else None
        if max_value is not None and min_value is not None:
            # min_value may be either queried or provided by the user. max_value was queried.
            # If min_value > max_value, then max_value should be adjusted with respect to
            # min_value, since min_value is a lower bound, and any and all data below
            # min_value should be ignored.
            max_value = max([max_value, min_value])

    return min_value, max_value


def find_span_op_count_histogram_min_max(
    span_op, min_value, max_value, user_query, params, data_filter=None
):
    """
    Find the min/max value of the specified span op count. If either min/max is already
    specified, it will be used and not queried for.

    :param str span_op: A span op for which count you want to generate the histograms for.
    :param float min_value: The minimum value allowed to be in the histogram.
        If left unspecified, it is queried using `user_query` and `params`.
    :param float max_value: The maximum value allowed to be in the histogram.
        If left unspecified, it is queried using `user_query` and `params`.
    :param str user_query: Filter query string to create conditions from.
    :param {str: str} params: Filtering parameters with start, end, project_id, environment
    :param str data_filter: Indicate the filter strategy to be applied to the data.
    """
    if min_value is not None and max_value is not None:
        return min_value, max_value

    selected_columns = []
    min_column = ""
    max_column = ""
    outlier_lower_fence = ""
    outlier_upper_fence = ""
    if min_value is None:
        min_column = f'fn_span_count("{span_op}", min)'
        selected_columns.append(min_column)
    if max_value is None:
        max_column = f'fn_span_count("{span_op}", max)'
        selected_columns.append(max_column)
    if data_filter == "exclude_outliers":
        outlier_lower_fence = f'fn_span_count("{span_op}", quantile(0.25))'
        outlier_upper_fence = f'fn_span_count("{span_op}", quantile(0.75))'
        selected_columns.append(outlier_lower_fence)
        selected_columns.append(outlier_upper_fence)

    results = query(
        selected_columns=selected_columns,
        query=user_query,
        params=params,
        limit=1,
        referrer="api.organization-spans-histogram-min-max",
        functions_acl=["fn_span_count"],
    )

    data = results.get("data")

    # there should be exactly 1 row in the results, but if something went wrong here,
    # we force the min/max to be None to coerce an empty histogram
    if data is None or len(data) != 1:
        return None, None

    row = data[0]

    if min_value is None:
        calculated_min_value = row[get_function_alias(min_column)]
        min_value = calculated_min_value if calculated_min_value else None
        if max_value is not None and min_value is not None:
            # max_value was provided by the user, and min_value was queried.
            # If min_value > max_value, then we adjust min_value with respect to
            # max_value. The rationale is that if the user provided max_value,
            # then any and all data above max_value should be ignored since it is
            # and upper bound.
            min_value = min([max_value, min_value])

    if max_value is None:
        calculated_max_value = row[get_function_alias(max_column)]
        max_value = calculated_max_value if calculated_max_value else None

        max_fence_value = None
        if data_filter == "exclude_outliers":
            outlier_lower_fence_alias = get_function_alias(outlier_lower_fence)
            outlier_upper_fence_alias = get_function_alias(outlier_upper_fence)

            first_quartile = row[outlier_lower_fence_alias]
            third_quartile = row[outlier_upper_fence_alias]

            if (
                first_quartile is not None
                or third_quartile is not None
                or not math.isnan(first_quartile)
                or not math.isnan(third_quartile)
            ):
                interquartile_range = abs(third_quartile - first_quartile)
                upper_outer_fence = third_quartile + 3 * interquartile_range
                max_fence_value = upper_outer_fence

        candidates = [max_fence_value, max_value]
        candidates = list(filter(lambda v: v is not None, candidates))
        max_value = min(candidates) if candidates else None
        if max_value is not None and min_value is not None:
            # min_value may be either queried or provided by the user. max_value was queried.
            # If min_value > max_value, then max_value should be adjusted with respect to
            # min_value, since min_value is a lower bound, and any and all data below
            # min_value should be ignored.
            max_value = max([max_value, min_value])

    return min_value, max_value


def find_histogram_min_max(
    fields, min_value, max_value, user_query, params, data_filter=None, query_fn=None
):
    """
    Find the min/max value of the specified fields. If either min/max is already
    specified, it will be used and not queried for.

    :param [str] fields: The list of fields for which you want to generate the histograms for.
    :param float min_value: The minimum value allowed to be in the histogram.
        If left unspecified, it is queried using `user_query` and `params`.
    :param float max_value: The maximum value allowed to be in the histogram.
        If left unspecified, it is queried using `user_query` and `params`.
    :param str user_query: Filter query string to create conditions from.
    :param {str: str} params: Filtering parameters with start, end, project_id, environment
    :param str data_filter: Indicate the filter strategy to be applied to the data.
    """

    if min_value is not None and max_value is not None:
        return min_value, max_value

    min_columns = []
    max_columns = []
    quartiles = []

    for field in fields:
        if min_value is None:
            min_columns.append(f"min({field})")
        if max_value is None:
            max_columns.append(f"max({field})")
        if data_filter == "exclude_outliers":
            quartiles.append(f"percentile({field}, 0.25)")
            quartiles.append(f"percentile({field}, 0.75)")

    if query_fn is None:
        query_fn = query

    results = query_fn(
        selected_columns=min_columns + max_columns + quartiles,
        query=user_query,
        params=params,
        limit=1,
        referrer="api.organization-events-histogram-min-max",
    )

    data = results.get("data")

    # there should be exactly 1 row in the results, but if something went wrong here,
    # we force the min/max to be None to coerce an empty histogram
    if data is None or len(data) != 1:
        return None, None

    row = data[0]

    if min_value is None:
        min_values = [row[get_function_alias(column)] for column in min_columns]
        min_values = list(filter(lambda v: v is not None, min_values))
        min_value = min(min_values) if min_values else None
        if max_value is not None and min_value is not None:
            # max_value was provided by the user, and min_value was queried.
            # If min_value > max_value, then we adjust min_value with respect to
            # max_value. The rationale is that if the user provided max_value,
            # then any and all data above max_value should be ignored since it is
            # and upper bound.
            min_value = min([max_value, min_value])

    if max_value is None:
        max_values = [row[get_function_alias(column)] for column in max_columns]
        max_values = list(filter(lambda v: v is not None, max_values))
        max_value = max(max_values) if max_values else None

        fences = []
        if data_filter == "exclude_outliers":
            for field in fields:
                q1_alias = get_function_alias(f"percentile({field}, 0.25)")
                q3_alias = get_function_alias(f"percentile({field}, 0.75)")

                first_quartile = row[q1_alias]
                third_quartile = row[q3_alias]

                if (
                    first_quartile is None
                    or third_quartile is None
                    or math.isnan(first_quartile)
                    or math.isnan(third_quartile)
                ):
                    continue

                interquartile_range = abs(third_quartile - first_quartile)
                upper_outer_fence = third_quartile + 3 * interquartile_range
                fences.append(upper_outer_fence)

        max_fence_value = max(fences) if fences else None

        candidates = [max_fence_value, max_value]
        candidates = list(filter(lambda v: v is not None, candidates))
        max_value = min(candidates) if candidates else None
        if max_value is not None and min_value is not None:
            # min_value may be either queried or provided by the user. max_value was queried.
            # If min_value > max_value, then max_value should be adjusted with respect to
            # min_value, since min_value is a lower bound, and any and all data below
            # min_value should be ignored.
            max_value = max([max_value, min_value])

    return min_value, max_value


def normalize_span_histogram_results(span, histogram_params, results):
    """
    Normalizes the span histogram results by renaming the columns to key and bin
    and make sure to zerofill any missing values.

    :param [Span] span: The span for which you want to generate the
        histograms for.
    :param HistogramParams histogram_params: The histogram parameters used.
    :param any results: The results from the histogram query that may be missing
        bins and needs to be normalized.
    """

    histogram_column = get_span_histogram_column(span, histogram_params)
    bin_name = get_function_alias(histogram_column)

    # zerofill and rename the columns while making sure to adjust for precision
    bucket_map = {}
    for row in results["data"]:
        # we expect the bin the be an integer, this is because all floating
        # point values are rounded during the calculation
        bucket = int(row[bin_name])
        bucket_map[bucket] = row["count"]

    new_data = []
    for i in range(histogram_params.num_buckets):
        bucket = histogram_params.start_offset + histogram_params.bucket_size * i
        row = {"bin": bucket, "count": bucket_map.get(bucket, 0)}
        if histogram_params.multiplier > 1:
            row["bin"] /= float(histogram_params.multiplier)
        new_data.append(row)

    return new_data


def normalize_histogram_results(fields, key_column, histogram_params, results, array_column):
    """
    Normalizes the histogram results by renaming the columns to key and bin
    and make sure to zerofill any missing values.

    :param [str] fields: The list of fields for which you want to generate the
        histograms for.
    :param str key_column: The column of the key name.
    :param HistogramParams histogram_params: The histogram parameters used.
    :param any results: The results from the histogram query that may be missing
        bins and needs to be normalized.
    :param str array_column: Array column prefix
    """

    # `key_name` is only used when generating a multi histogram of measurement values.
    # It contains the name of the corresponding measurement for that row.
    key_name = None if key_column is None else get_function_alias(key_column)
    histogram_column = get_histogram_column(fields, key_column, histogram_params, array_column)
    bin_name = get_function_alias(histogram_column)

    # zerofill and rename the columns while making sure to adjust for precision
    bucket_maps = {field: {} for field in fields}
    for row in results["data"]:
        # Fall back to the first field name if there is no `key_name`,
        # otherwise, this is an array value name and format it as such.
        key = (
            fields[0]
            if key_name is None
            else f"{get_array_column_alias(array_column)}.{get_array_column_field(array_column, row[key_name])}"
        )
        # we expect the bin the be an integer, this is because all floating
        # point values are rounded during the calculation
        bucket = int(row[bin_name])
        # ignore unexpected keys
        if key in bucket_maps:
            bucket_maps[key][bucket] = row["count"]

    new_data = {field: [] for field in fields}
    for i in range(histogram_params.num_buckets):
        bucket = histogram_params.start_offset + histogram_params.bucket_size * i
        for field in fields:
            row = {
                "bin": bucket,
                "count": bucket_maps[field].get(bucket, 0),
            }
            # make sure to adjust for the precision if necessary
            if histogram_params.multiplier > 1:
                row["bin"] /= float(histogram_params.multiplier)
            new_data[field].append(row)

    return new_data


def check_multihistogram_fields(fields):
    """
    Returns multihistogram type if all the given fields are of the same histogram type.
    Return false otherwise, or if any of the fields are not a compatible histogram type.
    Possible histogram types: measurements, span_op_breakdowns

    :param [str] fields: The list of fields for which you want to generate histograms for.
    """
    histogram_type = False
    for field in fields:
        if histogram_type is False:
            if is_measurement(field):
                histogram_type = "measurements"
            elif is_span_op_breakdown(field):
                histogram_type = "span_op_breakdowns"
            else:
                return False
        elif histogram_type == "measurements" and not is_measurement(field):
            return False
        elif histogram_type == "span_op_breakdowns" and not is_span_op_breakdown(field):
            return False
    return histogram_type


def corr_snuba_timeseries(
    x: Sequence[Tuple[int, Sequence[Dict[str, float]]]],
    y: Sequence[Tuple[int, Sequence[Dict[str, float]]]],
):
    """
    Returns the Pearson's coefficient of two snuba timeseries.
    """
    if len(x) != len(y):
        return

    n = len(x)
    sum_x, sum_y, sum_xy, sum_x_squared, sum_y_squared = 0, 0, 0, 0, 0
    for i in range(n):
        x_datum = x[i]
        y_datum = y[i]

        x_ = x_datum[1][0]["count"]
        y_ = y_datum[1][0]["count"]

        sum_x += x_
        sum_y += y_
        sum_xy += x_ * y_
        sum_x_squared += x_ * x_
        sum_y_squared += y_ * y_

    denominator = math.sqrt(
        (n * sum_x_squared - sum_x * sum_x) * (n * sum_y_squared - sum_y * sum_y)
    )
    if denominator == 0:
        return

    pearsons_corr_coeff = ((n * sum_xy) - (sum_x * sum_y)) / denominator

    return pearsons_corr_coeff
