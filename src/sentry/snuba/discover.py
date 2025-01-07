import logging
import math
import random
from collections import namedtuple
from collections.abc import Callable, Mapping, Sequence
from datetime import datetime, timedelta
from typing import Any, Literal, cast

import sentry_sdk
from sentry_relay.consts import SPAN_STATUS_CODE_TO_NAME
from snuba_sdk import Column, Condition, Function, Op

from sentry.discover.arithmetic import categorize_columns
from sentry.exceptions import InvalidSearchQuery
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.search.events.builder.discover import (
    DiscoverQueryBuilder,
    HistogramQueryBuilder,
    TimeseriesQueryBuilder,
    TopEventsQueryBuilder,
)
from sentry.search.events.fields import FIELD_ALIASES, get_function_alias, is_function
from sentry.search.events.types import (
    EventsResponse,
    HistogramParams,
    QueryBuilderConfig,
    SnubaData,
    SnubaParams,
    SnubaRow,
    Span,
)
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.extraction import MetricSpecType
from sentry.snuba.query_sources import QuerySource
from sentry.tagstore.base import TOP_VALUES_DEFAULT_LIMIT
from sentry.utils.math import nice_int
from sentry.utils.snuba import (
    SnubaTSResult,
    bulk_snuba_queries,
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
HistogramResults = dict[str, list[dict[str, Any]]]


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


def format_time(
    data: SnubaData, start_param: datetime, end_param: datetime, rollup: int, orderby: list[str]
) -> SnubaData:
    """Format the time field from a snuba response so that we can easily use it in the rest of processing"""
    return_value: SnubaData = []
    start = int(to_naive_timestamp(naiveify_datetime(start_param)) / rollup) * rollup
    end = (int(to_naive_timestamp(naiveify_datetime(end_param)) / rollup) * rollup) + rollup
    data_by_time: dict[int, SnubaData] = {}

    for row in data:
        # This is needed for SnQL, and was originally done in utils.snuba.get_snuba_translators
        if isinstance(row["time"], str):
            # `datetime.fromisoformat` is new in Python3.7 and before Python3.11, it is not a full
            # ISO 8601 parser. It is only the inverse function of `datetime.isoformat`, which is
            # the format returned by snuba. This is significantly faster when compared to other
            # parsers like `dateutil.parser.parse` and `datetime.strptime`.
            row["time"] = int(datetime.fromisoformat(row["time"]).timestamp())
        if row["time"] in data_by_time:
            data_by_time[row["time"]].append(row)
        else:
            data_by_time[row["time"]] = [row]

    for key in range(start, end, rollup):
        if key in data_by_time and len(data_by_time[key]) > 0:
            return_value.extend(data_by_time[key])

    if "-time" in orderby:
        return list(reversed(return_value))

    return return_value


def zerofill(
    data: SnubaData,
    start_param: datetime,
    end_param: datetime,
    rollup: int,
    orderby: list[str],
    time_col_name: str | None = None,
) -> SnubaData:
    """Fill in all the gaps in a timeseries response with a zero value so graphs render all the buckets"""
    return_value: SnubaData = []
    start = int(to_naive_timestamp(naiveify_datetime(start_param)) / rollup) * rollup
    end = (int(to_naive_timestamp(naiveify_datetime(end_param)) / rollup) * rollup) + rollup
    data_by_time: dict[int, SnubaData] = {}

    for row in data:
        if time_col_name and time_col_name in row:
            row["time"] = row.pop(time_col_name)
        # This is needed for SnQL, and was originally done in utils.snuba.get_snuba_translators
        if isinstance(row["time"], str):
            # `datetime.fromisoformat` is new in Python3.7 and before Python3.11, it is not a full
            # ISO 8601 parser. It is only the inverse function of `datetime.isoformat`, which is
            # the format returned by snuba. This is significantly faster when compared to other
            # parsers like `dateutil.parser.parse` and `datetime.strptime`.
            row["time"] = int(datetime.fromisoformat(row["time"]).timestamp())
        if row["time"] in data_by_time:
            data_by_time[row["time"]].append(row)
        else:
            data_by_time[row["time"]] = [row]

    for key in range(start, end, rollup):
        if key in data_by_time and len(data_by_time[key]) > 0:
            return_value.extend(data_by_time[key])
        else:
            return_value.append({"time": key})

    if "-time" in orderby:
        return list(reversed(return_value))

    return return_value


def transform_tips(tips: dict[str, set[str]]) -> dict[str, str | None]:
    """Handle the tips meta, so there's only one tip for query and column"""
    return {
        "query": random.choice(list(tips["query"])) if len(tips["query"]) > 0 else None,
        "columns": random.choice(list(tips["columns"])) if len(tips["columns"]) > 0 else None,
    }


def query(
    selected_columns: list[str],
    query: str,
    snuba_params: SnubaParams,
    equations: list[str] | None = None,
    orderby: list[str] | None = None,
    offset: int | None = None,
    limit: int = 50,
    referrer: str | None = None,
    auto_fields: bool = False,
    auto_aggregations: bool = False,
    include_equation_fields: bool = False,
    allow_metric_aggregates: bool = False,
    use_aggregate_conditions: bool = False,
    conditions: list[Condition] | None = None,
    functions_acl: list[str] | None = None,
    transform_alias_to_input_format: bool = False,
    sample: float | None = None,
    has_metrics: bool = False,
    use_metrics_layer: bool = False,
    skip_tag_resolution: bool = False,
    extra_columns: list[Column] | None = None,
    on_demand_metrics_enabled: bool = False,
    on_demand_metrics_type: MetricSpecType | None = None,
    dataset: Dataset = Dataset.Discover,
    fallback_to_transactions: bool = False,
    query_source: QuerySource | None = None,
) -> EventsResponse:
    """
    High-level API for doing arbitrary user queries against events.

    This function operates on the Discover public event schema and
    virtual fields/aggregate functions for selected columns and
    conditions are supported through this function.

    The resulting list will have all internal field names mapped
    back into their public schema names.

    selected_columns - List of public aliases to fetch.
    query - Filter query string to create conditions from.
    snuba_params - Filtering parameters with start, end, project_id, environment
    equations - List of equations to calculate for the query
    orderby - The field to order results by.
    offset - The record offset to read.
    limit - The number of records to fetch.
    referrer - A referrer string to help locate the origin of this query.
    auto_fields - Set to true to have project + eventid fields automatically added.
    auto_aggregations - Whether aggregates should be added automatically if they're used
                    in conditions, and there's at least one aggregate already.
    include_equation_fields - Whether fields should be added automatically if they're used in
                    equations
    allow_metric_aggregates - Ignored here, only used in metric enhanced performance
    use_aggregate_conditions - Set to true if aggregates conditions should be used at all.
    conditions - List of conditions that are passed directly to snuba without
                    any additional processing.
    transform_alias_to_input_format - Whether aggregate columns should be returned in the originally
                                requested function format.
    sample - The sample rate to run the query with
    fallback_to_transactions - Whether to fallback to the transactions dataset if the query
                    fails in metrics enhanced requests. To be removed once the discover dataset is split.
    """
    if not selected_columns:
        raise InvalidSearchQuery("No columns selected")

    assert dataset in [
        Dataset.Discover,
        Dataset.Transactions,
    ], "A dataset is required to query discover"

    builder = DiscoverQueryBuilder(
        dataset,
        params={},
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

    result = builder.process_results(
        builder.run_query(referrer=referrer, query_source=query_source)
    )
    result["meta"]["tips"] = transform_tips(builder.tips)
    return result


def _query_temp_do_not_use(
    selected_columns: list[str],
    query_string: str,
    snuba_params: SnubaParams,
    referrer: str | None = None,
):
    """There's a single function call in getsentry that we need to support as we remove params"""
    return query(
        selected_columns=selected_columns,
        query=query_string,
        snuba_params=snuba_params,
        referrer=referrer,
    )


def timeseries_query(
    selected_columns: Sequence[str],
    query: str,
    snuba_params: SnubaParams,
    rollup: int,
    referrer: str | None = None,
    zerofill_results: bool = True,
    comparison_delta: timedelta | None = None,
    functions_acl: list[str] | None = None,
    allow_metric_aggregates: bool = False,
    has_metrics: bool = False,
    use_metrics_layer: bool = False,
    on_demand_metrics_enabled: bool = False,
    on_demand_metrics_type: MetricSpecType | None = None,
    dataset: Dataset = Dataset.Discover,
    query_source: QuerySource | None = None,
    fallback_to_transactions: bool = False,
    transform_alias_to_input_format: bool = False,
) -> SnubaTSResult:
    """
    High-level API for doing arbitrary user timeseries queries against events.

    This function operates on the public event schema and
    virtual fields/aggregate functions for selected columns and
    conditions are supported through this function.

    This function is intended to only get timeseries based
    results and thus requires the `rollup` parameter.

    Returns a SnubaTSResult object that has been zerofilled in
    case of gaps.

    selected_columns - List of public aliases to fetch.
    query - Filter query string to create conditions from.
    snuba_params - Filtering parameters with start, end, project_id, environment,
    rollup - The bucket width in seconds
    referrer - A referrer string to help locate the origin of this query.
    comparison_delta - A timedelta used to convert this into a comparison query. We make a second
    query time-shifted back by comparison_delta, and compare the results to get the % change for each
    time bucket. Requires that we only pass
    allow_metric_aggregates - Ignored here, only used in metric enhanced performance
    fallback_to_transactions - Whether to fallback to the transactions dataset if the query
                    fails in metrics enhanced requests. To be removed once the discover dataset is split.
    transform_alias_to_input_format - Whether aggregate columns should be returned in the originally
                                requested function format.
    """
    assert dataset in [
        Dataset.Discover,
        Dataset.Transactions,
    ], "A dataset is required to query discover"

    with sentry_sdk.start_span(op="discover.discover", name="timeseries.filter_transform"):
        equations, columns = categorize_columns(selected_columns)
        base_builder = TimeseriesQueryBuilder(
            dataset,
            params={},
            interval=rollup,
            snuba_params=snuba_params,
            query=query,
            selected_columns=columns,
            equations=equations,
            config=QueryBuilderConfig(
                functions_acl=functions_acl,
                has_metrics=has_metrics,
                transform_alias_to_input_format=transform_alias_to_input_format,
            ),
        )
        query_list = [base_builder]
        if comparison_delta:
            if len(base_builder.aggregates) != 1:
                raise InvalidSearchQuery("Only one column can be selected for comparison queries")
            comp_query_params = snuba_params.copy()
            assert comp_query_params.start is not None, "start is required"
            assert comp_query_params.end is not None, "end is required"
            comp_query_params.start -= comparison_delta
            comp_query_params.end -= comparison_delta
            comparison_builder = TimeseriesQueryBuilder(
                dataset,
                params={},
                interval=rollup,
                snuba_params=comp_query_params,
                query=query,
                selected_columns=columns,
                equations=equations,
            )
            query_list.append(comparison_builder)

        query_results = bulk_snuba_queries(
            [query.get_snql_query() for query in query_list], referrer, query_source=query_source
        )

    with sentry_sdk.start_span(op="discover.discover", name="timeseries.transform_results"):
        results = []
        for snql_query, snuba_result in zip(query_list, query_results):
            results.append(
                {
                    "data": (
                        zerofill(
                            snuba_result["data"],
                            # Start and end are asserted to exist earlier in the function
                            cast(datetime, snql_query.params.start),
                            cast(datetime, snql_query.params.end),
                            rollup,
                            ["time"],
                        )
                        if zerofill_results
                        else snuba_result["data"]
                    ),
                    "meta": snuba_result["meta"],
                }
            )

    if len(results) == 2 and comparison_delta:
        col_name = base_builder.aggregates[0].alias
        # If we have two sets of results then we're doing a comparison queries. Divide the primary
        # results by the comparison results.
        for row, compared_row in zip(results[0]["data"], results[1]["data"]):
            compared_value = compared_row.get(col_name, 0)
            row["comparisonCount"] = compared_value

    result = base_builder.process_results(results[0])

    return SnubaTSResult(
        {"data": result["data"], "meta": result["meta"]},
        snuba_params.start_date,
        snuba_params.end_date,
        rollup,
    )


def create_result_key(
    result_row: SnubaRow, fields: list[str], issues: Mapping[int, str | None]
) -> str:
    """Create the string key to be used in the top events result dictionary"""
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
    timeseries_columns: list[str],
    selected_columns: list[str],
    user_query: str,
    snuba_params: SnubaParams,
    orderby: list[str],
    rollup: int,
    limit: int,
    organization: Organization,
    equations: list[str] | None = None,
    referrer: str | None = None,
    top_events: EventsResponse | None = None,
    allow_empty: bool = True,
    zerofill_results: bool = True,
    include_other: bool = False,
    functions_acl: list[str] | None = None,
    on_demand_metrics_enabled: bool = False,
    on_demand_metrics_type: MetricSpecType | None = None,
    dataset: Dataset = Dataset.Discover,
    query_source: QuerySource | None = None,
    fallback_to_transactions: bool = False,
) -> dict[str, SnubaTSResult] | SnubaTSResult:
    """
    High-level API for doing arbitrary user timeseries queries for a limited number of top events

    Returns a dictionary of SnubaTSResult objects that have been zerofilled in
    case of gaps. Each value of the dictionary should match the result of a timeseries query

    timeseries_columns - List of public aliases to fetch for the timeseries query,
                    usually matches the y-axis of the graph
    selected_columns - List of public aliases to fetch for the events query,
                    this is to determine what the top events are
    user_query - Filter query string to create conditions from. needs to be user_query
                    to not conflict with the function query
    snuba_params - Filtering parameters with start, end, project_id, environment,
    orderby - The fields to order results by.
    rollup - The bucket width in seconds
    limit - The number of events to get timeseries for
    organization - Used to map group ids to short ids
    referrer - A referrer string to help locate the origin of this query.
    top_events - A dictionary with a 'data' key containing a list of dictionaries that
                    represent the top events matching the query. Useful when you have found
                    the top events earlier and want to save a query.
    """
    assert dataset in [
        Dataset.Discover,
        Dataset.Transactions,
    ], "A dataset is required to query discover"

    if top_events is None:
        with sentry_sdk.start_span(op="discover.discover", name="top_events.fetch_events"):
            top_events = query(
                selected_columns,
                query=user_query,
                snuba_params=snuba_params,
                equations=equations,
                orderby=orderby,
                limit=limit,
                referrer=referrer,
                auto_aggregations=True,
                use_aggregate_conditions=True,
                include_equation_fields=True,
                skip_tag_resolution=True,
                dataset=dataset,
                query_source=query_source,
            )

    top_events_builder = TopEventsQueryBuilder(
        dataset,
        params={},
        interval=rollup,
        snuba_params=snuba_params,
        top_events=top_events["data"],
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
            dataset,
            params={},
            interval=rollup,
            top_events=top_events["data"],
            snuba_params=snuba_params,
            other=True,
            query=user_query,
            selected_columns=selected_columns,
            timeseries_columns=timeseries_columns,
            equations=equations,
        )
        result, other_result = bulk_snuba_queries(
            [top_events_builder.get_snql_query(), other_events_builder.get_snql_query()],
            referrer=referrer,
            query_source=query_source,
        )
    else:
        result = top_events_builder.run_query(referrer=referrer, query_source=query_source)
        other_result = {"data": []}
    if (
        not allow_empty
        and not len(result.get("data", []))
        and not len(other_result.get("data", []))
    ):
        return SnubaTSResult(
            {
                "data": (
                    zerofill([], snuba_params.start_date, snuba_params.end_date, rollup, ["time"])
                    if zerofill_results
                    else []
                ),
            },
            snuba_params.start_date,
            snuba_params.end_date,
            rollup,
        )
    with sentry_sdk.start_span(op="discover.discover", name="top_events.transform_results") as span:
        span.set_data("result_count", len(result.get("data", [])))
        result = top_events_builder.process_results(result)

        issues: Mapping[int, str | None] = {}
        if "issue" in selected_columns and dataset in {Dataset.Discover, Dataset.Events}:
            issues = Group.objects.get_issues_mapping(
                {cast(int, event["issue.id"]) for event in top_events["data"]},
                snuba_params.project_ids,
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

        top_events_results: dict[str, SnubaTSResult] = {}
        for key, item in results.items():
            top_events_results[key] = SnubaTSResult(
                {
                    "data": (
                        zerofill(
                            item["data"],
                            snuba_params.start_date,
                            snuba_params.end_date,
                            rollup,
                            ["time"],
                        )
                        if zerofill_results
                        else item["data"]
                    ),
                    "order": item["order"],
                },
                snuba_params.start_date,
                snuba_params.end_date,
                rollup,
            )

    return top_events_results


def get_facets(
    query: str | None,
    snuba_params: SnubaParams,
    referrer: str,
    per_page: int | None = TOP_KEYS_DEFAULT_LIMIT,
    cursor: int | None = 0,
    dataset: Dataset | None = Dataset.Discover,
) -> list[FacetResult]:
    """
    High-level API for getting 'facet map' results.

    Facets are high frequency tags and attribute results that
    can be used to further refine user queries. When many projects
    are requested sampling will be enabled to help keep response times low.

    query - Filter query string to create conditions from.
    params - Filtering parameters with start, end, project_id, environment
    referrer - A referrer string to help locate the origin of this query.
    per_page - The number of records to fetch.
    cursor - The number of records to skip.
    """

    assert dataset in [
        Dataset.Discover,
        Dataset.Transactions,
        Dataset.Events,
    ], "A dataset is required to query discover"

    sample = len(snuba_params.project_ids) > 2
    fetch_projects = len(snuba_params.project_ids) > 1

    with sentry_sdk.start_span(op="discover.discover", name="facets.frequent_tags"):
        key_name_builder = DiscoverQueryBuilder(
            dataset,
            params={},
            snuba_params=snuba_params,
            query=query,
            selected_columns=["tags_key", "count()"],
            orderby=["-count()", "tags_key"],
            limit=per_page,
            # Remove one from the cursor because if we fetch_projects then
            # a result is popped off and replaced with projects, offsetting
            # the pagination on subsequent pages
            offset=cursor - 1 if fetch_projects and cursor is not None and cursor > 0 else cursor,
            turbo=sample,
        )
        non_sample_columns = [
            key_name_builder.resolve_column("trace"),
            key_name_builder.resolve_column("id"),
        ]
        for condition in key_name_builder.where:
            if isinstance(condition, Condition):
                if condition.lhs in non_sample_columns:
                    key_name_builder.turbo = False
                    break
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
        with sentry_sdk.start_span(op="discover.discover", name="facets.projects"):
            project_value_builder = DiscoverQueryBuilder(
                dataset,
                params={},
                snuba_params=snuba_params,
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
        elif per_page is not None and i >= len(top_tags) - per_page:
            aggregate_tags.append(tag)
        else:
            individual_tags.append(tag)

    with sentry_sdk.start_span(op="discover.discover", name="facets.individual_tags") as span:
        span.set_data("tag_count", len(individual_tags))
        for tag_name in individual_tags:
            tag = f"tags[{tag_name}]"
            tag_value_builder = DiscoverQueryBuilder(
                dataset,
                params={},
                snuba_params=snuba_params,
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
        with sentry_sdk.start_span(op="discover.discover", name="facets.aggregate_tags"):
            aggregate_value_builder = DiscoverQueryBuilder(
                dataset,
                params={},
                snuba_params=snuba_params,
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
    span: Span,
    user_query: str,
    snuba_params: SnubaParams,
    num_buckets: int,
    precision: int = 0,
    min_value: float | None = None,
    max_value: float | None = None,
    data_filter: Literal["exclude_outliers"] | None = None,
    referrer: str | None = None,
    group_by: list[str] | None = None,
    order_by: list[str] | None = None,
    limit_by: list[str] | None = None,
    extra_condition: list[Condition] | None = None,
    normalize_results: bool = True,
    use_metrics_layer: bool = False,
    on_demand_metrics_enabled: bool = False,
    on_demand_metrics_type: MetricSpecType | None = None,
    query_source: QuerySource | None = None,
) -> EventsResponse | SnubaData:
    """
    API for generating histograms for span exclusive time.

    :param span: A span for which you want to generate histograms for.
    :param user_query: Filter query string to create conditions from.
    :param snuba_params: Filtering parameters with start, end, project_id, environment
    :param num_buckets: The number of buckets the histogram should contain.
    :param precision: The number of decimal places to preserve, default 0.
    :param min_value: The minimum value allowed to be in the histogram.
        If left unspecified, it is queried using `user_query` and `params`.
    :param max_value: The maximum value allowed to be in the histogram.
        If left unspecified, it is queried using `user_query` and `params`.
    :param data_filter: Indicate the filter strategy to be applied to the data.
    :param group_by: Allows additional grouping to serve multifacet histograms.
    :param order_by: Allows additional ordering within each alias to serve multifacet histograms.
    :param limit_by: Allows limiting within a group when serving multifacet histograms.
    :param extra_condition: Adds any additional conditions to the histogram query
    :param normalize_results: Indicate whether to normalize the results by column into bins.
    """
    multiplier = int(10**precision)
    if max_value is not None:
        # We want the specified max_value to be exclusive, and the queried max_value
        # to be inclusive. So we adjust the specified max_value using the multiplier.
        max_value -= 0.1 / multiplier

    min_value, max_value = find_span_histogram_min_max(
        span, min_value, max_value, user_query, snuba_params, data_filter
    )

    key_column = None
    histogram_rows = None

    histogram_params = find_histogram_params(num_buckets, min_value, max_value, multiplier)
    histogram_column = get_span_histogram_column(span, histogram_params)

    builder = HistogramQueryBuilder(
        num_buckets,
        histogram_column,
        histogram_rows,
        histogram_params,
        key_column,
        [],
        group_by,
        # Arguments for QueryBuilder
        Dataset.Discover,
        params={},
        snuba_params=snuba_params,
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
    results = builder.run_query(referrer, query_source=query_source)

    if not normalize_results:
        return results

    return normalize_span_histogram_results(span, histogram_params, results)


def histogram_query(
    fields: list[str],
    user_query: str,
    snuba_params: SnubaParams,
    num_buckets: int,
    precision: int = 0,
    min_value: float | None = None,
    max_value: float | None = None,
    data_filter: Literal["exclude_outliers"] | None = None,
    referrer: str | None = None,
    group_by: list[str] | None = None,
    order_by: list[str] | None = None,
    limit_by: list[str] | None = None,
    histogram_rows: int | None = None,
    extra_conditions: list[Condition] | None = None,
    normalize_results: bool = True,
    use_metrics_layer: bool = False,
    on_demand_metrics_enabled: bool = False,
    on_demand_metrics_type: MetricSpecType | None = None,
    query_source: QuerySource | None = None,
):
    """
    API for generating histograms for numeric columns.

    A multihistogram is possible only if the columns are all array columns.
    Array columns are columns whose values are nested arrays.
    Measurements and span op breakdowns are examples of array columns.
    The resulting histograms will have their bins aligned.

    :param fields: The list of fields for which you want to generate histograms for.
    :param user_query: Filter query string to create conditions from.
    :param snuba_params: Filtering parameters with start, end, project_id, environment
    :param num_buckets: The number of buckets the histogram should contain.
    :param precision: The number of decimal places to preserve, default 0.
    :param min_value: The minimum value allowed to be in the histogram.
        If left unspecified, it is queried using `user_query` and `params`.
    :param max_value: The maximum value allowed to be in the histogram.
        If left unspecified, it is queried using `user_query` and `params`.
    :param data_filter: Indicate the filter strategy to be applied to the data.
    :param group_by: Allows additional grouping to serve multifacet histograms.
    :param order_by: Allows additional ordering within each alias to serve multifacet histograms.
    :param limit_by: Allows limiting within a group when serving multifacet histograms.
    :param histogram_rows: Used to modify the limit when fetching multiple rows of buckets (performance facets).
    :param extra_conditions: Adds any additional conditions to the histogram query that aren't received from params.
    :param normalize_results: Indicate whether to normalize the results by column into bins.
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
        snuba_params,
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
            fields,
            key_column,
            histogram_params,
            {"data": [], "meta": {"fields": {}, "tips": {}}},
            array_column,
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
        params={},
        snuba_params=snuba_params,
        query=user_query,
        selected_columns=fields,
        orderby=order_by,
        limitby=limit_by,
    )
    if extra_conditions is not None:
        builder.add_conditions(extra_conditions)
    results = builder.process_results(builder.run_query(referrer, query_source=query_source))

    if not normalize_results:
        return results

    return normalize_histogram_results(fields, key_column, histogram_params, results, array_column)


def get_span_histogram_column(span: Span, histogram_params: HistogramParams) -> str:
    """
    Generate the histogram column string for spans.

    :param span: The span for which you want to generate the histograms for.
    :param histogram_params: The histogram parameters used.
    """
    span_op = span.op
    span_group = span.group
    return f'spans_histogram("{span_op}", {span_group}, {histogram_params.bucket_size:d}, {histogram_params.start_offset:d}, {histogram_params.multiplier:d})'


def get_histogram_column(
    fields: list[str],
    key_column: str | None,
    histogram_params: HistogramParams,
    array_column: str | None,
) -> str:
    """
    Generate the histogram column string.

    :param fields: The list of fields for which you want to generate the histograms for.
    :param key_column: The column for the key name. This is only set when generating a
        multihistogram of array values. Otherwise, it should be `None`.
    :param histogram_params: The histogram parameters used.
    :param array_column: Array column prefix
    """
    field = fields[0] if key_column is None else f"{array_column}_value"
    return f"histogram({field}, {histogram_params.bucket_size:d}, {histogram_params.start_offset:d}, {histogram_params.multiplier:d})"


def find_histogram_params(
    num_buckets: int, min_value: float | None, max_value: float | None, multiplier: int
) -> HistogramParams:
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


def find_span_histogram_min_max(
    span: Span,
    min_value: float | None,
    max_value: float | None,
    user_query: str,
    snuba_params: SnubaParams,
    data_filter: Literal["exclude_outliers"] | None = None,
) -> tuple[float | None, float | None]:
    """
    Find the min/max value of the specified span. If either min/max is already
    specified, it will be used and not queried for.

    :param span: A span for which you want to generate the histograms for.
    :param min_value: The minimum value allowed to be in the histogram.
        If left unspecified, it is queried using `user_query` and `params`.
    :param max_value: The maximum value allowed to be in the histogram.
        If left unspecified, it is queried using `user_query` and `params`.
    :param user_query: Filter query string to create conditions from.
    :param snuba_params: Filtering parameters with start, end, project_id, environment
    :param data_filter: Indicate the filter strategy to be applied to the data.
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
        snuba_params=snuba_params,
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
                and third_quartile is not None
                and not math.isnan(first_quartile)
                and not math.isnan(third_quartile)
            ):
                interquartile_range = abs(third_quartile - first_quartile)
                upper_outer_fence = third_quartile + 3 * interquartile_range
                max_fence_value = upper_outer_fence

        candidates: list[float] = []
        for candidate_value in [max_fence_value, max_value]:
            if isinstance(candidate_value, float):
                candidates.append(candidate_value)
        max_value = min(candidates) if candidates else None
        if max_value is not None and min_value is not None:
            # min_value may be either queried or provided by the user. max_value was queried.
            # If min_value > max_value, then max_value should be adjusted with respect to
            # min_value, since min_value is a lower bound, and any and all data below
            # min_value should be ignored.
            max_value = max([max_value, min_value])

    return min_value, max_value


def find_span_op_count_histogram_min_max(
    span_op: str,
    min_value: float | None,
    max_value: float | None,
    user_query: str,
    snuba_params: SnubaParams,
    data_filter: Literal["exclude_outliers"] | None = None,
) -> tuple[float | None, float | None]:
    """
    Find the min/max value of the specified span op count. If either min/max is already
    specified, it will be used and not queried for.

    :param span_op: A span op for which count you want to generate the histograms for.
    :param min_value: The minimum value allowed to be in the histogram.
        If left unspecified, it is queried using `user_query` and `params`.
    :param max_value: The maximum value allowed to be in the histogram.
        If left unspecified, it is queried using `user_query` and `params`.
    :param user_query: Filter query string to create conditions from.
    :param params: Filtering parameters with start, end, project_id, environment
    :param data_filter: Indicate the filter strategy to be applied to the data.
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
        snuba_params=snuba_params,
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
                and third_quartile is not None
                and not math.isnan(first_quartile)
                and not math.isnan(third_quartile)
            ):
                interquartile_range = abs(third_quartile - first_quartile)
                upper_outer_fence = third_quartile + 3 * interquartile_range
                max_fence_value = upper_outer_fence

        candidates: list[float] = []
        for candidate_value in [max_fence_value, max_value]:
            if isinstance(candidate_value, float):
                candidates.append(candidate_value)
        max_value = min(candidates) if candidates else None
        if max_value is not None and min_value is not None:
            # min_value may be either queried or provided by the user. max_value was queried.
            # If min_value > max_value, then max_value should be adjusted with respect to
            # min_value, since min_value is a lower bound, and any and all data below
            # min_value should be ignored.
            max_value = max([max_value, min_value])

    return min_value, max_value


def find_histogram_min_max(
    fields: list[str],
    min_value: float | None,
    max_value: float | None,
    user_query: str,
    snuba_params: SnubaParams,
    data_filter: Literal["exclude_outliers"] | None = None,
    query_fn: Callable | None = None,
) -> tuple[float | None, float | None]:
    """
    Find the min/max value of the specified fields. If either min/max is already
    specified, it will be used and not queried for.

    :param fields: The list of fields for which you want to generate the histograms for.
    :param min_value: The minimum value allowed to be in the histogram.
        If left unspecified, it is queried using `user_query` and `params`.
    :param max_value: The maximum value allowed to be in the histogram.
        If left unspecified, it is queried using `user_query` and `params`.
    :param user_query: Filter query string to create conditions from.
    :param params: Filtering parameters with start, end, project_id, environment
    :param data_filter: Indicate the filter strategy to be applied to the data.
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
        snuba_params=snuba_params,
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

        candidates = [cand for cand in (max_fence_value, max_value) if cand is not None]
        max_value = min(candidates) if candidates else None
        if max_value is not None and min_value is not None:
            # min_value may be either queried or provided by the user. max_value was queried.
            # If min_value > max_value, then max_value should be adjusted with respect to
            # min_value, since min_value is a lower bound, and any and all data below
            # min_value should be ignored.
            max_value = max([max_value, min_value])

    return min_value, max_value


def normalize_span_histogram_results(
    span: Span, histogram_params: HistogramParams, results: EventsResponse
) -> SnubaData:
    """
    Normalizes the span histogram results by renaming the columns to key and bin
    and make sure to zerofill any missing values.

    :param span: The span for which you want to generate the
        histograms for.
    :param histogram_params: The histogram parameters used.
    :param results: The results from the histogram query that may be missing
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


def normalize_histogram_results(
    fields: list[str],
    key_column: str | None,
    histogram_params: HistogramParams,
    results: EventsResponse,
    array_column: str | None,
) -> HistogramResults:
    """
    Normalizes the histogram results by renaming the columns to key and bin
    and make sure to zerofill any missing values.

    :param fields: The list of fields for which you want to generate the
        histograms for.
    :param key_column: The column of the key name.
    :param histogram_params: The histogram parameters used.
    :param results: The results from the histogram query that may be missing
        bins and needs to be normalized.
    :param array_column: Array column prefix
    """

    # `key_name` is only used when generating a multi histogram of measurement values.
    # It contains the name of the corresponding measurement for that row.
    key_name = None if key_column is None else get_function_alias(key_column)
    histogram_column = get_histogram_column(fields, key_column, histogram_params, array_column)
    bin_name = get_function_alias(histogram_column)

    # zerofill and rename the columns while making sure to adjust for precision
    bucket_maps: dict[str, dict[int, int]] = {field: {} for field in fields}
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

    new_data: HistogramResults = {field: [] for field in fields}
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


def check_multihistogram_fields(
    fields: list[str],
) -> Literal["measurements", "span_op_breakdowns"] | None:
    """
    Returns multihistogram type if all the given fields are of the same histogram type.
    Return false otherwise, or if any of the fields are not a compatible histogram type.
    Possible histogram types: measurements, span_op_breakdowns

    :param fields: The list of fields for which you want to generate histograms for.
    """
    histogram_type: Literal["measurements", "span_op_breakdowns"] | None = None
    for field in fields:
        if histogram_type is None:
            if is_measurement(field):
                histogram_type = "measurements"
            elif is_span_op_breakdown(field):
                histogram_type = "span_op_breakdowns"
            else:
                return None
        elif histogram_type == "measurements" and not is_measurement(field):
            return None
        elif histogram_type == "span_op_breakdowns" and not is_span_op_breakdown(field):
            return None
    return histogram_type


def corr_snuba_timeseries(
    x: Sequence[tuple[int, Sequence[dict[str, float]]]],
    y: Sequence[tuple[int, Sequence[dict[str, float]]]],
) -> float | None:
    """
    Returns the Pearson's coefficient of two snuba timeseries.
    """
    if len(x) != len(y):
        return None

    n = len(x)
    sum_x, sum_y, sum_xy, sum_x_squared, sum_y_squared = 0.0, 0.0, 0.0, 0.0, 0.0
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
        return None

    pearsons_corr_coeff = ((n * sum_xy) - (sum_x * sum_y)) / denominator

    return pearsons_corr_coeff
