import logging
import math
from collections import namedtuple
from copy import deepcopy
from datetime import timedelta
from typing import Dict, Optional, Sequence

import sentry_sdk

from sentry import options
from sentry.discover.arithmetic import categorize_columns, resolve_equation_list
from sentry.models import Group
from sentry.models.transaction_threshold import ProjectTransactionThreshold
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.constants import CONFIGURABLE_AGGREGATES, DEFAULT_PROJECT_THRESHOLD
from sentry.search.events.fields import (
    FIELD_ALIASES,
    InvalidSearchQuery,
    get_function_alias,
    get_json_meta_type,
    is_function,
    resolve_field_list,
)
from sentry.search.events.filter import get_filter
from sentry.tagstore.base import TOP_VALUES_DEFAULT_LIMIT
from sentry.utils.compat import filter
from sentry.utils.math import mean, nice_int
from sentry.utils.snuba import (
    SNUBA_AND,
    SNUBA_OR,
    Dataset,
    SnubaQueryParams,
    SnubaTSResult,
    bulk_raw_query,
    get_array_column_alias,
    get_array_column_field,
    get_measurement_name,
    get_span_op_breakdown_name,
    is_measurement,
    is_span_op_breakdown,
    naiveify_datetime,
    raw_query,
    raw_snql_query,
    resolve_column,
    resolve_snuba_aliases,
    to_naive_timestamp,
)

__all__ = (
    "PaginationResult",
    "InvalidSearchQuery",
    "query",
    "prepare_discover_query",
    "timeseries_query",
    "top_events_timeseries",
    "get_facets",
    "transform_data",
    "zerofill",
    "histogram_query",
    "check_multihistogram_fields",
)


logger = logging.getLogger(__name__)

PreparedQuery = namedtuple("query", ["filter", "columns", "fields"])
PaginationResult = namedtuple("PaginationResult", ["next", "previous", "oldest", "latest"])
FacetResult = namedtuple("FacetResult", ["key", "value", "count"])

resolve_discover_column = resolve_column(Dataset.Discover)

OTHER_KEY = "Other"


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


def resolve_discover_aliases(snuba_filter, function_translations=None):
    """
    Resolve the public schema aliases to the discover dataset.

    Returns a copy of the input structure, and includes a
    `translated_columns` key containing the selected fields that need to
    be renamed in the result set.
    """
    return resolve_snuba_aliases(
        snuba_filter, resolve_discover_column, function_translations=function_translations
    )


def zerofill(data, start, end, rollup, orderby):
    rv = []
    start = int(to_naive_timestamp(naiveify_datetime(start)) / rollup) * rollup
    end = (int(to_naive_timestamp(naiveify_datetime(end)) / rollup) * rollup) + rollup
    data_by_time = {}

    for obj in data:
        if obj["time"] in data_by_time:
            data_by_time[obj["time"]].append(obj)
        else:
            data_by_time[obj["time"]] = [obj]

    for key in range(start, end, rollup):
        if key in data_by_time and len(data_by_time[key]) > 0:
            rv = rv + data_by_time[key]
            data_by_time[key] = []
        else:
            rv.append({"time": key})

    if "-time" in orderby:
        return list(reversed(rv))

    return rv


def transform_results(results, function_alias_map, translated_columns, snuba_filter):
    results = transform_data(results, translated_columns, snuba_filter)
    results["meta"] = transform_meta(results, function_alias_map)
    return results


def transform_meta(results, function_alias_map):
    meta = {
        value["name"]: get_json_meta_type(
            value["name"], value.get("type"), function_alias_map.get(value["name"])
        )
        for value in results["meta"]
    }
    # Ensure all columns in the result have types.
    if results["data"]:
        for key in results["data"][0]:
            if key not in meta:
                meta[key] = "string"
    return meta


def transform_data(result, translated_columns, snuba_filter):
    """
    Transform internal names back to the public schema ones.

    When getting timeseries results via rollup, this function will
    zerofill the output results.
    """
    for col in result["meta"]:
        # Translate back column names that were converted to snuba format
        col["name"] = translated_columns.get(col["name"], col["name"])

    def get_row(row):
        transformed = {}
        for key, value in row.items():
            if isinstance(value, float):
                # 0 for nan, and none for inf were chosen arbitrarily, nan and inf are invalid json
                # so needed to pick something valid to use instead
                if math.isnan(value):
                    value = 0
                elif math.isinf(value):
                    value = None
            transformed[translated_columns.get(key, key)] = value

        return transformed

    result["data"] = [get_row(row) for row in result["data"]]

    if snuba_filter and snuba_filter.rollup and snuba_filter.rollup > 0:
        rollup = snuba_filter.rollup
        with sentry_sdk.start_span(
            op="discover.discover", description="transform_results.zerofill"
        ) as span:
            span.set_data("result_count", len(result.get("data", [])))
            result["data"] = zerofill(
                result["data"], snuba_filter.start, snuba_filter.end, rollup, snuba_filter.orderby
            )

    return result


def query(
    selected_columns,
    query,
    params,
    equations=None,
    orderby=None,
    offset=None,
    limit=50,
    referrer=None,
    auto_fields=False,
    auto_aggregations=False,
    use_aggregate_conditions=False,
    conditions=None,
    functions_acl=None,
    use_snql=False,
):
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
    use_aggregate_conditions (bool) Set to true if aggregates conditions should be used at all.
    conditions (Sequence[any]) List of conditions that are passed directly to snuba without
                    any additional processing.
    use_snql (bool) Whether to directly build the query in snql, instead of using the older
                    json construction
    """
    if not selected_columns:
        raise InvalidSearchQuery("No columns selected")

    sentry_sdk.set_tag("discover.use_snql", use_snql)
    if use_snql:
        # temporarily add snql to referrer
        referrer = f"{referrer}.wip-snql"
        builder = QueryBuilder(
            Dataset.Discover,
            params,
            query=query,
            selected_columns=selected_columns,
            orderby=orderby,
            auto_fields=auto_fields,
            auto_aggregations=auto_aggregations,
            use_aggregate_conditions=use_aggregate_conditions,
            functions_acl=functions_acl,
            limit=limit,
            offset=offset,
        )
        snql_query = builder.get_snql_query()

        result = raw_snql_query(snql_query, referrer)
        with sentry_sdk.start_span(
            op="discover.discover", description="query.transform_results"
        ) as span:
            span.set_data("result_count", len(result.get("data", [])))
            result = transform_results(result, builder.function_alias_map, {}, None)
        return result

    # We clobber this value throughout this code, so copy the value
    selected_columns = selected_columns[:]

    snuba_query = prepare_discover_query(
        selected_columns,
        query,
        params,
        equations,
        orderby,
        auto_fields,
        auto_aggregations,
        use_aggregate_conditions,
        conditions,
        functions_acl,
    )
    snuba_filter = snuba_query.filter

    with sentry_sdk.start_span(op="discover.discover", description="query.snuba_query"):
        result = raw_query(
            start=snuba_filter.start,
            end=snuba_filter.end,
            groupby=snuba_filter.groupby,
            conditions=snuba_filter.conditions,
            aggregations=snuba_filter.aggregations,
            selected_columns=snuba_filter.selected_columns,
            filter_keys=snuba_filter.filter_keys,
            having=snuba_filter.having,
            orderby=snuba_filter.orderby,
            dataset=Dataset.Discover,
            limit=limit,
            offset=offset,
            referrer=referrer,
        )

    with sentry_sdk.start_span(
        op="discover.discover", description="query.transform_results"
    ) as span:
        span.set_data("result_count", len(result.get("data", [])))
        return transform_results(
            result,
            snuba_query.fields["functions"],
            snuba_query.columns,
            snuba_filter,
        )


def prepare_discover_query(
    selected_columns,
    query,
    params,
    equations=None,
    orderby=None,
    auto_fields=False,
    auto_aggregations=False,
    use_aggregate_conditions=False,
    conditions=None,
    functions_acl=None,
):
    with sentry_sdk.start_span(
        op="discover.discover", description="query.filter_transform"
    ) as span:
        span.set_data("query", query)

        snuba_filter = get_filter(query, params)
        if not use_aggregate_conditions:
            assert (
                not auto_aggregations
            ), "Auto aggregations cannot be used without enabling aggregate conditions"
            snuba_filter.having = []

    with sentry_sdk.start_span(op="discover.discover", description="query.field_translations"):
        if equations is not None:
            resolved_equations, _ = resolve_equation_list(equations, selected_columns)
        else:
            resolved_equations = []

        if orderby is not None:
            orderby = list(orderby) if isinstance(orderby, (list, tuple)) else [orderby]
            snuba_filter.orderby = [get_function_alias(o) for o in orderby]

        resolved_fields = resolve_field_list(
            selected_columns,
            snuba_filter,
            auto_fields=auto_fields,
            auto_aggregations=auto_aggregations,
            functions_acl=functions_acl,
            resolved_equations=resolved_equations,
        )

        snuba_filter.update_with(resolved_fields)

        # Resolve the public aliases into the discover dataset names.
        snuba_filter, translated_columns = resolve_discover_aliases(snuba_filter)

        # Make sure that any aggregate conditions are also in the selected columns
        for having_clause in snuba_filter.having:
            # The first element of the having can be an alias, or a nested array of functions. Loop through to make sure
            # any referenced functions are in the aggregations.
            error_extra = ", and could not be automatically added" if auto_aggregations else ""
            if isinstance(having_clause[0], (list, tuple)):
                # Functions are of the form [fn, [args]]
                args_to_check = [[having_clause[0]]]
                conditions_not_in_aggregations = []
                while len(args_to_check) > 0:
                    args = args_to_check.pop()
                    for arg in args:
                        if arg[0] in [SNUBA_AND, SNUBA_OR]:
                            args_to_check.extend(arg[1])
                        # Only need to iterate on arg[1] if its a list
                        elif isinstance(arg[1], (list, tuple)):
                            alias = arg[1][0]
                            found = any(
                                alias == agg_clause[-1] for agg_clause in snuba_filter.aggregations
                            )
                            if not found:
                                conditions_not_in_aggregations.append(alias)

                if len(conditions_not_in_aggregations) > 0:
                    raise InvalidSearchQuery(
                        "Aggregate(s) {} used in a condition but are not in the selected columns{}.".format(
                            ", ".join(conditions_not_in_aggregations),
                            error_extra,
                        )
                    )
            else:
                found = any(
                    having_clause[0] == agg_clause[-1] for agg_clause in snuba_filter.aggregations
                )
                if not found:
                    raise InvalidSearchQuery(
                        "Aggregate {} used in a condition but is not a selected column{}.".format(
                            having_clause[0],
                            error_extra,
                        )
                    )

        if conditions is not None:
            snuba_filter.conditions.extend(conditions)

    return PreparedQuery(snuba_filter, translated_columns, resolved_fields)


def get_timeseries_snuba_filter(selected_columns, query, params):
    snuba_filter = get_filter(query, params)
    if not snuba_filter.start and not snuba_filter.end:
        raise InvalidSearchQuery("Cannot get timeseries result without a start and end.")

    equations, columns = categorize_columns(selected_columns)

    if len(equations) > 0:
        resolved_equations, updated_columns = resolve_equation_list(
            equations, columns, aggregates_only=True, auto_add=True
        )
    else:
        resolved_equations = []
        updated_columns = columns

    # For the new apdex, we need to add project threshold config as a selected
    # column which means the group by for the time series won't work.
    # As a temporary solution, we will calculate the mean of all the project
    # level thresholds in the request and use the legacy apdex, user_misery
    # or count_miserable calculation.
    # TODO(snql): Alias the project_threshold_config column so it doesn't
    # have to be in the SELECT statement and group by to be able to use new apdex,
    # user_misery and count_miserable.
    threshold = None
    for agg in CONFIGURABLE_AGGREGATES:
        if agg not in updated_columns:
            continue

        if threshold is None:
            project_ids = params.get("project_id")
            threshold_configs = list(
                ProjectTransactionThreshold.objects.filter(
                    organization_id=params["organization_id"],
                    project_id__in=project_ids,
                ).values_list("threshold", flat=True)
            )

            projects_without_threshold = len(project_ids) - len(threshold_configs)
            threshold_configs.extend([DEFAULT_PROJECT_THRESHOLD] * projects_without_threshold)
            threshold = int(mean(threshold_configs))

        updated_columns.remove(agg)
        updated_columns.append(CONFIGURABLE_AGGREGATES[agg].format(threshold=threshold))

    snuba_filter.update_with(
        resolve_field_list(
            updated_columns, snuba_filter, auto_fields=False, resolved_equations=resolved_equations
        )
    )

    # Resolve the public aliases into the discover dataset names.
    snuba_filter, translated_columns = resolve_discover_aliases(snuba_filter)
    if not snuba_filter.aggregations:
        raise InvalidSearchQuery("Cannot get timeseries result with no aggregation.")

    return snuba_filter, translated_columns


def timeseries_query(
    selected_columns: Sequence[str],
    query: str,
    params: Dict[str, str],
    rollup: int,
    referrer: Optional[str] = None,
    zerofill_results: bool = True,
    comparison_delta: Optional[timedelta] = None,
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
    """
    with sentry_sdk.start_span(
        op="discover.discover", description="timeseries.filter_transform"
    ) as span:
        span.set_data("query", query)
        snuba_filter, _ = get_timeseries_snuba_filter(selected_columns, query, params)

    with sentry_sdk.start_span(op="discover.discover", description="timeseries.snuba_query"):
        base_query_params = SnubaQueryParams(
            # Hack cause equations on aggregates have to go in selected columns instead of aggregations
            selected_columns=[
                column
                for column in snuba_filter.selected_columns
                # Check that the column is a list with 3 items, and the alias in the third item is an equation
                if isinstance(column, list)
                and len(column) == 3
                and column[-1].startswith("equation[")
            ],
            aggregations=snuba_filter.aggregations,
            conditions=snuba_filter.conditions,
            filter_keys=snuba_filter.filter_keys,
            start=snuba_filter.start,
            end=snuba_filter.end,
            rollup=rollup,
            orderby="time",
            groupby=["time"],
            dataset=Dataset.Discover,
            limit=10000,
            referrer=referrer,
        )
        query_params_list = [base_query_params]
        if comparison_delta:
            if len(base_query_params.aggregations) != 1:
                raise InvalidSearchQuery("Only one column can be selected for comparison queries")
            comp_query_params = deepcopy(base_query_params)
            comp_query_params.start -= comparison_delta
            comp_query_params.end -= comparison_delta
            query_params_list.append(comp_query_params)
        query_results = bulk_raw_query(query_params_list, referrer=referrer)

    with sentry_sdk.start_span(
        op="discover.discover", description="timeseries.transform_results"
    ) as span:
        results = []
        for query_params, query_results in zip(query_params_list, query_results):
            span.set_data("result_count", len(query_results.get("data", [])))
            results.append(
                zerofill(
                    query_results["data"], query_params.start, query_params.end, rollup, "time"
                )
                if zerofill_results
                else query_results["data"]
            )

    if len(results) == 2:
        col_name = base_query_params.aggregations[0][2]
        # If we have two sets of results then we're doing a comparison queries. Divide the primary
        # results by the comparison results.
        for result, cmp_result in zip(results[0], results[1]):
            cmp_result_val = cmp_result.get(col_name, 0)
            result["comparisonCount"] = cmp_result_val

    results = results[0]

    return SnubaTSResult({"data": results}, snuba_filter.start, snuba_filter.end, rollup)


def create_result_key(result_row, fields, issues) -> str:
    values = []
    for field in fields:
        if field == "issue.id":
            values.append(issues.get(result_row["issue.id"], "unknown"))
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
            )

    with sentry_sdk.start_span(
        op="discover.discover", description="top_events.filter_transform"
    ) as span:
        span.set_data("query", user_query)
        snuba_filter, translated_columns = get_timeseries_snuba_filter(
            list(sorted(set(timeseries_columns + selected_columns))),
            user_query,
            params,
        )
        original_conditions = snuba_filter.conditions[:]
        other_conditions = []

        for field in selected_columns:
            # If we have a project field, we need to limit results by project so we don't hit the result limit
            if field in ["project", "project.id"] and top_events["data"]:
                snuba_filter.project_ids = [event["project.id"] for event in top_events["data"]]
                continue

            if field in FIELD_ALIASES:
                alias = FIELD_ALIASES[field].alias
            else:
                alias = field
            # Note that because orderby shouldn't be an array field its not included in the values
            values = list(
                {
                    event.get(alias)
                    for event in top_events["data"]
                    if (field in event or alias in event) and not isinstance(event.get(field), list)
                }
            )
            if values:
                if field in FIELD_ALIASES:
                    # Fallback to the alias if for whatever reason we can't find it
                    resolved_field = alias
                    # Issue needs special handling since its aliased uniquely
                    if field == "issue":
                        resolved_field = "group_id"
                    else:
                        # Search selected columns for the resolved version of the alias
                        for column in snuba_filter.selected_columns:
                            if isinstance(column, list) and (
                                column[-1] == field or column[-1] == alias
                            ):
                                resolved_field = column
                                break
                else:
                    resolved_field = resolve_discover_column(field)

                if field == "timestamp" or field.startswith("timestamp.to_"):
                    # timestamp fields needs special handling, creating a big OR instead
                    snuba_filter.conditions.append(
                        [[resolved_field, "=", value] for value in sorted(values)]
                    )

                    # Needs to be a big AND when negated
                    other_condition = [resolved_field, "!=", values[0]]
                    for value in sorted(values[1:]):
                        other_condition = [
                            [SNUBA_AND, [other_condition, [resolved_field, "!=", value]]],
                            "=",
                            1,
                        ]
                    other_conditions.append(other_condition)
                elif None in values:
                    # one of the values was null, but we can't do an in with null values, so split into two conditions
                    non_none_values = [value for value in values if value is not None]
                    condition = [[["isNull", [resolved_field]], "=", 1]]
                    other_condition = [["isNull", [resolved_field]], "!=", 1]
                    if non_none_values:
                        condition.append([resolved_field, "IN", non_none_values])
                        other_condition = [
                            [
                                SNUBA_AND,
                                [
                                    [resolved_field, "NOT IN", non_none_values],
                                    other_condition,
                                ],
                            ],
                            "=",
                            1,
                        ]
                    snuba_filter.conditions.append(condition)
                    other_conditions.append(other_condition)
                else:
                    snuba_filter.conditions.append([resolved_field, "IN", values])
                    other_conditions.append([resolved_field, "NOT IN", values])

    with sentry_sdk.start_span(op="discover.discover", description="top_events.snuba_query"):
        top_5_query = {
            "aggregations": snuba_filter.aggregations,
            "conditions": snuba_filter.conditions,
            "filter_keys": snuba_filter.filter_keys,
            "selected_columns": snuba_filter.selected_columns,
            "start": snuba_filter.start,
            "end": snuba_filter.end,
            "rollup": rollup,
            "orderby": ["time"] + snuba_filter.groupby,
            "groupby": ["time"] + snuba_filter.groupby,
            "dataset": Dataset.Discover,
            "limit": 10000,
            "referrer": referrer,
        }
        if len(top_events["data"]) == limit and include_other:
            other_query = {
                "aggregations": snuba_filter.aggregations,
                "conditions": original_conditions + [other_conditions],
                "filter_keys": snuba_filter.filter_keys,
                # Hack cause equations on aggregates have to go in selected columns instead of aggregations
                "selected_columns": [
                    column
                    for column in snuba_filter.selected_columns
                    # Check that the column is a list with 3 items, and the alias in the third item is an equation
                    if isinstance(column, list)
                    and len(column) == 3
                    and column[-1].startswith("equation[")
                ],
                "start": snuba_filter.start,
                "end": snuba_filter.end,
                "rollup": rollup,
                "orderby": ["time"],
                "groupby": ["time"],
                "dataset": Dataset.Discover,
                "limit": 10000,
                "referrer": referrer + ".other",
            }
            result, other_result = bulk_raw_query(
                [SnubaQueryParams(**top_5_query), SnubaQueryParams(**other_query)],
                referrer=referrer,
            )
        else:
            result = raw_query(**top_5_query)
            other_result = {"data": []}

    if (
        not allow_empty
        and not len(result.get("data", []))
        and not len(other_result.get("data", []))
    ):
        return SnubaTSResult(
            {
                "data": zerofill([], snuba_filter.start, snuba_filter.end, rollup, "time")
                if zerofill_results
                else [],
            },
            snuba_filter.start,
            snuba_filter.end,
            rollup,
        )

    with sentry_sdk.start_span(
        op="discover.discover", description="top_events.transform_results"
    ) as span:
        span.set_data("result_count", len(result.get("data", [])))
        result = transform_data(result, translated_columns, snuba_filter)

        if "project" in selected_columns:
            translated_columns["project_id"] = "project"
        translated_groupby = [
            translated_columns.get(groupby, groupby) for groupby in snuba_filter.groupby
        ]

        issues = {}
        if "issue" in selected_columns:
            issues = Group.issues_mapping(
                {event["issue.id"] for event in top_events["data"]},
                params["project_id"],
                organization,
            )
        # so the result key is consistent
        translated_groupby.sort()

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
                    "data": zerofill(
                        item["data"], snuba_filter.start, snuba_filter.end, rollup, "time"
                    )
                    if zerofill_results
                    else item["data"],
                    "order": item["order"],
                },
                snuba_filter.start,
                snuba_filter.end,
                rollup,
            )

    return results


def get_id(result):
    if result:
        return result[1]


def get_facets(query, params, limit=10, referrer=None):
    """
    High-level API for getting 'facet map' results.

    Facets are high frequency tags and attribute results that
    can be used to further refine user queries. When many projects
    are requested sampling will be enabled to help keep response times low.

    query (str) Filter query string to create conditions from.
    params (Dict[str, str]) Filtering parameters with start, end, project_id, environment
    limit (int) The number of records to fetch.
    referrer (str|None) A referrer string to help locate the origin of this query.

    Returns Sequence[FacetResult]
    """
    with sentry_sdk.start_span(
        op="discover.discover", description="facets.filter_transform"
    ) as span:
        span.set_data("query", query)
        snuba_filter = get_filter(query, params)

        # Resolve the public aliases into the discover dataset names.
        snuba_filter, translated_columns = resolve_discover_aliases(snuba_filter)

    # Exclude tracing tags as they are noisy and generally not helpful.
    # TODO(markus): Tracing tags are no longer written but may still reside in DB.
    excluded_tags = ["tags_key", "NOT IN", ["trace", "trace.ctx", "trace.span", "project"]]

    # Sampling keys for multi-project results as we don't need accuracy
    # with that much data.
    sample = len(snuba_filter.filter_keys["project_id"]) > 2

    with sentry_sdk.start_span(op="discover.discover", description="facets.frequent_tags"):
        # Get the most frequent tag keys
        key_names = raw_query(
            aggregations=[["count", None, "count"]],
            start=snuba_filter.start,
            end=snuba_filter.end,
            conditions=snuba_filter.conditions,
            filter_keys=snuba_filter.filter_keys,
            orderby=["-count", "tags_key"],
            groupby="tags_key",
            having=[excluded_tags],
            dataset=Dataset.Discover,
            limit=limit,
            referrer=referrer,
            turbo=sample,
        )
        top_tags = [r["tags_key"] for r in key_names["data"]]
        if not top_tags:
            return []

    # TODO(mark) Make the sampling rate scale based on the result size and scaling factor in
    # sentry.options. To test the lowest acceptable sampling rate, we use 0.1 which
    # is equivalent to turbo. We don't use turbo though as we need to re-scale data, and
    # using turbo could cause results to be wrong if the value of turbo is changed in snuba.
    sampling_enabled = options.get("discover2.tags_facet_enable_sampling")
    sample_rate = 0.1 if (sampling_enabled and key_names["data"][0]["count"] > 10000) else None
    # Rescale the results if we're sampling
    multiplier = 1 / sample_rate if sample_rate is not None else 1

    fetch_projects = False
    if len(params.get("project_id", [])) > 1:
        if len(top_tags) == limit:
            top_tags.pop()
        fetch_projects = True

    results = []
    if fetch_projects:
        with sentry_sdk.start_span(op="discover.discover", description="facets.projects"):
            project_values = raw_query(
                aggregations=[["count", None, "count"]],
                start=snuba_filter.start,
                end=snuba_filter.end,
                conditions=snuba_filter.conditions,
                filter_keys=snuba_filter.filter_keys,
                groupby="project_id",
                orderby="-count",
                dataset=Dataset.Discover,
                referrer=referrer,
                sample=sample_rate,
                # Ensures Snuba will not apply FINAL
                turbo=sample_rate is not None,
            )
            results.extend(
                [
                    FacetResult("project", r["project_id"], int(r["count"]) * multiplier)
                    for r in project_values["data"]
                ]
            )

    # Get tag counts for our top tags. Fetching them individually
    # allows snuba to leverage promoted tags better and enables us to get
    # the value count we want.
    max_aggregate_tags = options.get("discover2.max_tags_to_combine")
    individual_tags = []
    aggregate_tags = []
    for i, tag in enumerate(top_tags):
        if tag == "environment":
            # Add here tags that you want to be individual
            individual_tags.append(tag)
        elif i >= len(top_tags) - max_aggregate_tags:
            aggregate_tags.append(tag)
        else:
            individual_tags.append(tag)

    with sentry_sdk.start_span(
        op="discover.discover", description="facets.individual_tags"
    ) as span:
        span.set_data("tag_count", len(individual_tags))
        for tag_name in individual_tags:
            tag = f"tags[{tag_name}]"
            tag_values = raw_query(
                aggregations=[["count", None, "count"]],
                conditions=snuba_filter.conditions,
                start=snuba_filter.start,
                end=snuba_filter.end,
                filter_keys=snuba_filter.filter_keys,
                orderby=["-count"],
                groupby=[tag],
                limit=TOP_VALUES_DEFAULT_LIMIT,
                dataset=Dataset.Discover,
                referrer=referrer,
                sample=sample_rate,
                # Ensures Snuba will not apply FINAL
                turbo=sample_rate is not None,
            )
            results.extend(
                [
                    FacetResult(tag_name, r[tag], int(r["count"]) * multiplier)
                    for r in tag_values["data"]
                ]
            )

    if aggregate_tags:
        with sentry_sdk.start_span(op="discover.discover", description="facets.aggregate_tags"):
            conditions = snuba_filter.conditions
            conditions.append(["tags_key", "IN", aggregate_tags])
            tag_values = raw_query(
                aggregations=[["count", None, "count"]],
                conditions=conditions,
                start=snuba_filter.start,
                end=snuba_filter.end,
                filter_keys=snuba_filter.filter_keys,
                orderby=["tags_key", "-count"],
                groupby=["tags_key", "tags_value"],
                dataset=Dataset.Discover,
                referrer=referrer,
                sample=sample_rate,
                # Ensures Snuba will not apply FINAL
                turbo=sample_rate is not None,
                limitby=[TOP_VALUES_DEFAULT_LIMIT, "tags_key"],
            )
            results.extend(
                [
                    FacetResult(r["tags_key"], r["tags_value"], int(r["count"]) * multiplier)
                    for r in tag_values["data"]
                ]
            )

    return results


HistogramParams = namedtuple(
    "HistogramParams", ["num_buckets", "bucket_size", "start_offset", "multiplier"]
)


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
    :param [str] extra_conditions: Adds any additional conditions to the histogram query that aren't received from params.
    :param bool normalize_results: Indicate whether to normalize the results by column into bins.
    """

    multiplier = int(10 ** precision)
    if max_value is not None:
        # We want the specified max_value to be exclusive, and the queried max_value
        # to be inclusive. So we adjust the specified max_value using the multiplier.
        max_value -= 0.1 / multiplier
    min_value, max_value = find_histogram_min_max(
        fields, min_value, max_value, user_query, params, data_filter
    )

    key_column = None
    array_column = None
    histogram_function = None
    conditions = []
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

        key_alias = get_function_alias(key_column)
        field_names = [histogram_function(field) for field in fields]
        conditions.append([key_alias, "IN", field_names])

    if extra_conditions:
        conditions.extend(extra_conditions)

    histogram_params = find_histogram_params(num_buckets, min_value, max_value, multiplier)
    histogram_column = get_histogram_column(fields, key_column, histogram_params, array_column)
    histogram_alias = get_function_alias(histogram_column)

    if min_value is None or max_value is None:
        return normalize_histogram_results(
            fields, key_column, histogram_params, {"data": []}, array_column
        )
    # make sure to bound the bins to get the desired range of results
    if min_value is not None:
        min_bin = histogram_params.start_offset
        conditions.append([histogram_alias, ">=", min_bin])
    if max_value is not None:
        max_bin = histogram_params.start_offset + histogram_params.bucket_size * num_buckets
        conditions.append([histogram_alias, "<=", max_bin])

    columns = [] if key_column is None else [key_column]
    groups = len(fields) if histogram_rows is None else histogram_rows
    limit = groups * num_buckets

    histogram_query = prepare_discover_query(
        selected_columns=columns + [histogram_column, "count()"],
        conditions=conditions,
        query=user_query,
        params=params,
        orderby=(order_by if order_by else []) + [histogram_alias],
        functions_acl=["array_join", "histogram"],
    )

    snuba_filter = histogram_query.filter

    if group_by:
        snuba_filter.groupby += group_by

    result = raw_query(
        start=snuba_filter.start,
        end=snuba_filter.end,
        groupby=snuba_filter.groupby,
        conditions=snuba_filter.conditions,
        aggregations=snuba_filter.aggregations,
        selected_columns=snuba_filter.selected_columns,
        filter_keys=snuba_filter.filter_keys,
        having=snuba_filter.having,
        orderby=snuba_filter.orderby,
        dataset=Dataset.Discover,
        limitby=limit_by,
        limit=limit,
        referrer=referrer,
    )

    results = transform_results(
        result,
        histogram_query.fields["functions"],
        histogram_query.columns,
        snuba_filter,
    )

    if not normalize_results:
        return results

    return normalize_histogram_results(fields, key_column, histogram_params, results, array_column)


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
    arguments, ensure that the generated histogram encapsolates the desired range.

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


def find_histogram_min_max(fields, min_value, max_value, user_query, params, data_filter=None):
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

    results = query(
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
