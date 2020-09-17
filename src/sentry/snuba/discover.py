from __future__ import absolute_import

import math
import sentry_sdk
import six
import logging

from collections import namedtuple
from copy import deepcopy
from datetime import timedelta
from math import ceil, floor

from sentry import options
from sentry.api.event_search import (
    FIELD_ALIASES,
    get_filter,
    get_function_alias,
    is_function,
    InvalidSearchQuery,
    resolve_field_list,
)

from sentry import eventstore

from sentry.models import Project, ProjectStatus, Group
from sentry.tagstore.base import TOP_VALUES_DEFAULT_LIMIT
from sentry.utils.snuba import (
    Dataset,
    naiveify_datetime,
    raw_query,
    resolve_snuba_aliases,
    resolve_column,
    SNUBA_AND,
    SNUBA_OR,
    SnubaTSResult,
    to_naive_timestamp,
)

__all__ = (
    "ReferenceEvent",
    "PaginationResult",
    "InvalidSearchQuery",
    "create_reference_event_conditions",
    "query",
    "key_transaction_query",
    "timeseries_query",
    "top_events_timeseries",
    "get_facets",
    "transform_results",
    "zerofill",
)


logger = logging.getLogger(__name__)

ReferenceEvent = namedtuple("ReferenceEvent", ["organization", "slug", "fields", "start", "end"])
ReferenceEvent.__new__.__defaults__ = (None, None)

PaginationResult = namedtuple("PaginationResult", ["next", "previous", "oldest", "latest"])
FacetResult = namedtuple("FacetResult", ["key", "value", "count"])

resolve_discover_column = resolve_column(Dataset.Discover)


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


def find_reference_event(reference_event):
    try:
        project_slug, event_id = reference_event.slug.split(":")
    except ValueError:
        raise InvalidSearchQuery("Invalid reference event format")

    column_names = [
        resolve_discover_column(col) for col in reference_event.fields if is_real_column(col)
    ]
    # We don't need to run a query if there are no columns
    if not column_names:
        return None

    try:
        project = Project.objects.get(
            slug=project_slug,
            organization=reference_event.organization,
            status=ProjectStatus.VISIBLE,
        )
    except Project.DoesNotExist:
        raise InvalidSearchQuery("Invalid reference event project")

    start = None
    end = None
    if reference_event.start:
        start = reference_event.start - timedelta(seconds=5)
    if reference_event.end:
        end = reference_event.end + timedelta(seconds=5)

    # We use raw_query here because generating conditions from an eventstore
    # event requires non-trivial translation from the flat list of fields into
    # structured fields like message, stack, and tags.
    event = raw_query(
        selected_columns=column_names,
        filter_keys={"project_id": [project.id], "event_id": [event_id]},
        start=start,
        end=end,
        dataset=Dataset.Discover,
        limit=1,
        referrer="discover.find_reference_event",
    )
    if "error" in event or len(event["data"]) != 1:
        raise InvalidSearchQuery("Unable to find reference event")

    return event["data"][0]


def create_reference_event_conditions(reference_event):
    """
    Create a list of conditions based on a Reference object.

    This is useful when you want to get results that match an exemplar
    event. A use case of this is generating pagination links for, or getting
    timeseries results of the records inside a single aggregated row.

    reference_event (ReferenceEvent) The reference event to build conditions from.
    """
    conditions = []
    event_data = find_reference_event(reference_event)
    if event_data is None:
        return conditions

    field_names = [resolve_discover_column(col) for col in reference_event.fields]
    for (i, field) in enumerate(reference_event.fields):
        value = event_data.get(field_names[i], None)
        # If the value is a sequence use the first element as snuba
        # doesn't support `=` or `IN` operations on fields like exception_frames.filename
        if isinstance(value, (list, set)) and value:
            value = value.pop()
        if value:
            conditions.append([field, "=", value])

    return conditions


# TODO (evanh) This whole function is here because we are using the max value to
# calculate the entire bucket width. If we could do that in a smarter way,
# we could avoid this whole calculation.
def find_histogram_buckets(field, params, conditions):
    match = is_function(field)
    if not match:
        raise InvalidSearchQuery(u"received {}, expected histogram function".format(field))

    columns = [c.strip() for c in match.group("columns").split(",") if len(c.strip()) > 0]

    if len(columns) != 2:
        raise InvalidSearchQuery(
            u"histogram(...) expects 2 column arguments, received {:g} arguments".format(
                len(columns)
            )
        )

    column = columns[0]
    # TODO evanh: This can be expanded to more fields at a later date, for now keep this limited.
    if column != "transaction.duration":
        raise InvalidSearchQuery(
            "histogram(...) can only be used with the transaction.duration column"
        )

    try:
        num_buckets = int(columns[1])
        if num_buckets < 1 or num_buckets > 500:
            raise Exception()
    except Exception:
        raise InvalidSearchQuery(
            u"histogram(...) requires a bucket value between 1 and 500, not {}".format(columns[1])
        )

    max_alias = u"max_{}".format(column)
    min_alias = u"min_{}".format(column)

    conditions = deepcopy(conditions) if conditions else []
    found = False
    for cond in conditions:
        if len(cond) == 3 and (cond[0], cond[1], cond[2]) == ("event.type", "=", "transaction"):
            found = True
            break
    if not found:
        conditions.append(["event.type", "=", "transaction"])
    snuba_filter = eventstore.Filter(conditions=conditions)
    translated_args, _ = resolve_discover_aliases(snuba_filter)

    results = raw_query(
        filter_keys={"project_id": params.get("project_id")},
        start=params.get("start"),
        end=params.get("end"),
        dataset=Dataset.Discover,
        conditions=translated_args.conditions,
        aggregations=[["max", "duration", max_alias], ["min", "duration", min_alias]],
    )
    if len(results["data"]) != 1:
        # If there are no transactions, so no max duration, return one empty bucket
        return "histogram({}, 1, 1, 0)".format(column)

    bucket_min = results["data"][0][min_alias]
    bucket_max = results["data"][0][max_alias]
    if bucket_max == 0:
        raise InvalidSearchQuery(u"Cannot calculate histogram for {}".format(field))
    bucket_size = ceil((bucket_max - bucket_min) / float(num_buckets))
    if bucket_size == 0.0:
        bucket_size = 1.0

    # Determine the first bucket that will show up in our results so that we can
    # zerofill correctly.
    offset = int(floor(bucket_min / bucket_size) * bucket_size)

    return "histogram({}, {:g}, {:.0f}, {:.0f})".format(column, num_buckets, bucket_size, offset)


def zerofill_histogram(results, column_meta, orderby, sentry_function_alias, snuba_function_alias):
    parts = snuba_function_alias.split("_")
    # the histogram alias looks like `histogram_column_numbuckets_bucketsize_bucketoffest`
    if len(parts) < 5 or parts[0] != "histogram":
        raise Exception(u"{} is not a valid histogram alias".format(snuba_function_alias))

    bucket_offset, bucket_size, num_buckets = int(parts[-1]), int(parts[-2]), int(parts[-3])
    if len(results) == num_buckets:
        return results

    dummy_data = {}
    for column in column_meta:
        dummy_data[column["name"]] = "" if column.get("type") == "String" else 0

    def build_new_bucket_row(bucket):
        row = {key: value for key, value in six.iteritems(dummy_data)}
        row[sentry_function_alias] = bucket
        return row

    bucket_map = {r[sentry_function_alias]: r for r in results}
    new_results = []
    is_sorted, is_reversed = False, False
    if orderby:
        for o in orderby:
            if o.lstrip("-") == snuba_function_alias:
                is_sorted = True
                is_reversed = o.startswith("-")
                break

    for i in range(num_buckets):
        bucket = bucket_offset + (bucket_size * i)
        if bucket not in bucket_map:
            bucket_map[bucket] = build_new_bucket_row(bucket)

    # If the list was sorted, pull results out in sorted order, else concat the results
    if is_sorted:
        i, diff, end = (0, 1, num_buckets) if not is_reversed else (num_buckets, -1, 0)
        while i <= end:
            bucket = bucket_offset + (bucket_size * i)
            if bucket in bucket_map:
                new_results.append(bucket_map[bucket])
            i += diff
    else:
        new_results = results
        exists = set(r[sentry_function_alias] for r in results)
        for bucket in bucket_map:
            if bucket not in exists:
                new_results.append(bucket_map[bucket])

    return new_results


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

    for key in six.moves.xrange(start, end, rollup):
        if key in data_by_time and len(data_by_time[key]) > 0:
            rv = rv + data_by_time[key]
            data_by_time[key] = []
        else:
            rv.append({"time": key})

    if "-time" in orderby:
        return list(reversed(rv))

    return rv


def transform_results(result, translated_columns, snuba_filter, selected_columns=None):
    """
    Transform internal names back to the public schema ones.

    When getting timeseries results via rollup, this function will
    zerofill the output results.
    """
    if selected_columns is None:
        selected_columns = []

    meta = []
    for col in result["meta"]:
        # Translate back column names that were converted to snuba format
        col["name"] = translated_columns.get(col["name"], col["name"])
        # Remove user fields as they will be replaced by the alias.
        meta.append(col)

    def get_row(row):
        transformed = {}
        for key, value in row.items():
            if isinstance(value, float) and math.isnan(value):
                value = 0
            transformed[translated_columns.get(key, key)] = value

        return transformed

    if len(translated_columns):
        result["data"] = [get_row(row) for row in result["data"]]

    rollup = snuba_filter.rollup
    if rollup and rollup > 0:
        with sentry_sdk.start_span(
            op="discover.discover", description="transform_results.zerofill"
        ) as span:
            span.set_data("result_count", len(result.get("data", [])))
            result["data"] = zerofill(
                result["data"], snuba_filter.start, snuba_filter.end, rollup, snuba_filter.orderby
            )

    for col in result["meta"]:
        if col["name"].startswith("histogram"):
            # The column name here has been translated, we need the original name
            for snuba_name, sentry_name in six.iteritems(translated_columns):
                if sentry_name == col["name"]:
                    with sentry_sdk.start_span(
                        op="discover.discover", description="transform_results.histogram_zerofill"
                    ) as span:
                        span.set_data("histogram_function", snuba_name)
                        result["data"] = zerofill_histogram(
                            result["data"],
                            result["meta"],
                            snuba_filter.orderby,
                            sentry_name,
                            snuba_name,
                        )
            break

    return result


def query(
    selected_columns,
    query,
    params,
    orderby=None,
    offset=None,
    limit=50,
    reference_event=None,
    referrer=None,
    auto_fields=False,
    use_aggregate_conditions=False,
    conditions=None,
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
    orderby (None|str|Sequence[str]) The field to order results by.
    offset (None|int) The record offset to read.
    limit (int) The number of records to fetch.
    reference_event (ReferenceEvent) A reference event object. Used to generate additional
                    conditions based on the provided reference.
    referrer (str|None) A referrer string to help locate the origin of this query.
    auto_fields (bool) Set to true to have project + eventid fields automatically added.
    conditions (Sequence[any]) List of conditions that are passed directly to snuba without
                    any additional processing.
    """
    if not selected_columns:
        raise InvalidSearchQuery("No columns selected")
    else:
        # We clobber this value throughout this code, so copy the value
        selected_columns = selected_columns[:]

    with sentry_sdk.start_span(
        op="discover.discover", description="query.filter_transform"
    ) as span:
        span.set_data("query", query)

        snuba_filter = get_filter(query, params)
        if not use_aggregate_conditions:
            snuba_filter.having = []

    # We need to run a separate query to be able to properly bucket the values for the histogram
    # Do that here, and format the bucket number in to the columns before passing it through
    # to event search.
    idx = 0
    function_translations = {}
    for col in selected_columns:
        if col.startswith("histogram("):
            with sentry_sdk.start_span(
                op="discover.discover", description="query.histogram_calculation"
            ) as span:
                span.set_data("histogram", col)
                histogram_column = find_histogram_buckets(col, params, snuba_filter.conditions)
                selected_columns[idx] = histogram_column
                snuba_name = get_function_alias(histogram_column)
                sentry_name = get_function_alias(col)
                function_translations[snuba_name] = sentry_name
                # Since we're completely renaming the histogram function, we need to also check if we are
                # ordering by the histogram values, and change that.
                if orderby is not None:
                    orderby = list(orderby) if isinstance(orderby, (list, tuple)) else [orderby]
                    for i, ordering in enumerate(orderby):
                        if sentry_name == ordering.lstrip("-"):
                            ordering = "{}{}".format(
                                "-" if ordering.startswith("-") else "", snuba_name
                            )
                            orderby[i] = ordering

            break

        idx += 1

    with sentry_sdk.start_span(op="discover.discover", description="query.field_translations"):
        if orderby is not None:
            orderby = list(orderby) if isinstance(orderby, (list, tuple)) else [orderby]
            snuba_filter.orderby = [get_function_alias(o) for o in orderby]

        snuba_filter.update_with(
            resolve_field_list(selected_columns, snuba_filter, auto_fields=auto_fields)
        )

        if reference_event:
            ref_conditions = create_reference_event_conditions(reference_event)
            if ref_conditions:
                snuba_filter.conditions.extend(ref_conditions)

        # Resolve the public aliases into the discover dataset names.
        snuba_filter, translated_columns = resolve_discover_aliases(
            snuba_filter, function_translations
        )

        # Make sure that any aggregate conditions are also in the selected columns
        for having_clause in snuba_filter.having:
            # The first element of the having can be an alias, or a nested array of functions. Loop through to make sure
            # any referenced functions are in the aggregations.
            if isinstance(having_clause[0], (list, tuple)):
                # Functions are of the form [fn, [args]]
                args_to_check = [[having_clause[0]]]
                conditions_not_in_aggregations = []
                while len(args_to_check) > 0:
                    args = args_to_check.pop()
                    for arg in args:
                        if arg[0] in [SNUBA_AND, SNUBA_OR]:
                            args_to_check.extend(arg[1])
                        else:
                            alias = arg[1][0]
                            found = any(
                                alias == agg_clause[-1] for agg_clause in snuba_filter.aggregations
                            )
                            if not found:
                                conditions_not_in_aggregations.append(alias)

                if len(conditions_not_in_aggregations) > 0:
                    raise InvalidSearchQuery(
                        u"Aggregate(s) {} used in a condition but are not in the selected columns.".format(
                            ", ".join(conditions_not_in_aggregations)
                        )
                    )
            else:
                found = any(
                    having_clause[0] == agg_clause[-1] for agg_clause in snuba_filter.aggregations
                )
                if not found:
                    raise InvalidSearchQuery(
                        u"Aggregate {} used in a condition but is not a selected column.".format(
                            having_clause[0]
                        )
                    )

        if conditions is not None:
            snuba_filter.conditions.extend(conditions)

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
        return transform_results(result, translated_columns, snuba_filter, selected_columns)


def key_transaction_conditions(queryset):
    """
        The snuba query for transactions is of the form
        (transaction="1" AND project=1) OR (transaction="2" and project=2) ...
        which the schema intentionally doesn't support so we cannot do an AND in OR
        so here the "and" operator is being instead to do an AND in OR query
    """
    return [
        [
            # First layer is Ands
            [
                # Second layer is Ors
                [
                    "and",
                    [
                        [
                            "equals",
                            # Without the outer ' here, the transaction will be treated as another column
                            # instead of a string. This isn't an injection risk since snuba is smart enough to
                            # handle escaping for us.
                            ["transaction", u"'{}'".format(transaction.transaction)],
                        ],
                        ["equals", ["project_id", transaction.project.id]],
                    ],
                ],
                "=",
                1,
            ]
            for transaction in queryset
        ]
    ]


def key_transaction_query(selected_columns, user_query, params, orderby, referrer, queryset):
    return query(
        selected_columns,
        user_query,
        params,
        orderby=orderby,
        referrer=referrer,
        conditions=key_transaction_conditions(queryset),
        use_aggregate_conditions=True,
    )


def get_timeseries_snuba_filter(
    selected_columns, query, params, rollup, reference_event=None, default_count=True
):
    snuba_filter = get_filter(query, params)
    if not snuba_filter.start and not snuba_filter.end:
        raise InvalidSearchQuery("Cannot get timeseries result without a start and end.")

    snuba_filter.update_with(resolve_field_list(selected_columns, snuba_filter, auto_fields=False))
    if reference_event:
        ref_conditions = create_reference_event_conditions(reference_event)
        if ref_conditions:
            snuba_filter.conditions.extend(ref_conditions)

    # Resolve the public aliases into the discover dataset names.
    snuba_filter, translated_columns = resolve_discover_aliases(snuba_filter)
    if not snuba_filter.aggregations:
        raise InvalidSearchQuery("Cannot get timeseries result with no aggregation.")

    # Change the alias of the first aggregation to count. This ensures compatibility
    # with other parts of the timeseries endpoint expectations
    if len(snuba_filter.aggregations) == 1 and default_count:
        snuba_filter.aggregations[0][2] = "count"

    return snuba_filter, translated_columns


def key_transaction_timeseries_query(selected_columns, query, params, rollup, referrer, queryset):
    """ Given a queryset of KeyTransactions perform a timeseries query

        This function is intended to match the `timeseries_query` function,
        but exists to avoid including conditions as a parameter on that function.

        selected_columns (Sequence[str]) List of public aliases to fetch.
        query (str) Filter query string to create conditions from.
        params (Dict[str, str]) Filtering parameters with start, end, project_id, environment,
        rollup (int) The bucket width in seconds
        referrer (str|None) A referrer string to help locate the origin of this query.
        queryset (QuerySet) Filtered QuerySet of KeyTransactions
    """
    with sentry_sdk.start_span(
        op="discover.discover", description="kt_timeseries.filter_transform"
    ) as span:
        span.set_data("query", query)
        snuba_filter, _ = get_timeseries_snuba_filter(selected_columns, query, params, rollup)

    if queryset.exists():
        snuba_filter.conditions.extend(key_transaction_conditions(queryset))

        with sentry_sdk.start_span(op="discover.discover", description="kt_timeseries.snuba_query"):
            result = raw_query(
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
    else:
        result = {"data": []}

    with sentry_sdk.start_span(
        op="discover.discover", description="kt_timeseries.transform_results"
    ) as span:
        span.set_data("result_count", len(result.get("data", [])))
        result = zerofill(result["data"], snuba_filter.start, snuba_filter.end, rollup, "time")

        return SnubaTSResult({"data": result}, snuba_filter.start, snuba_filter.end, rollup)


def timeseries_query(selected_columns, query, params, rollup, reference_event=None, referrer=None):
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
    reference_event (ReferenceEvent) A reference event object. Used to generate additional
                    conditions based on the provided reference.
    referrer (str|None) A referrer string to help locate the origin of this query.
    """
    with sentry_sdk.start_span(
        op="discover.discover", description="timeseries.filter_transform"
    ) as span:
        span.set_data("query", query)
        snuba_filter, _ = get_timeseries_snuba_filter(
            selected_columns, query, params, rollup, reference_event
        )

    with sentry_sdk.start_span(op="discover.discover", description="timeseries.snuba_query"):
        result = raw_query(
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

    with sentry_sdk.start_span(
        op="discover.discover", description="timeseries.transform_results"
    ) as span:
        span.set_data("result_count", len(result.get("data", [])))
        result = zerofill(result["data"], snuba_filter.start, snuba_filter.end, rollup, "time")

        return SnubaTSResult({"data": result}, snuba_filter.start, snuba_filter.end, rollup)


def create_result_key(result_row, fields, issues):
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
            values.append(six.text_type(value))
    return ",".join(values)


def top_events_timeseries(
    timeseries_columns,
    selected_columns,
    user_query,
    params,
    orderby,
    rollup,
    limit,
    organization,
    referrer=None,
    top_events=None,
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
    """
    if top_events is None:
        with sentry_sdk.start_span(op="discover.discover", description="top_events.fetch_events"):
            top_events = query(
                selected_columns,
                query=user_query,
                params=params,
                orderby=orderby,
                limit=limit,
                referrer=referrer,
                use_aggregate_conditions=True,
            )

    with sentry_sdk.start_span(
        op="discover.discover", description="top_events.filter_transform"
    ) as span:
        span.set_data("query", user_query)
        snuba_filter, translated_columns = get_timeseries_snuba_filter(
            list(set(timeseries_columns + selected_columns)),
            user_query,
            params,
            rollup,
            default_count=False,
        )

        for field in selected_columns:
            # project is handled by filter_keys already
            if field in ["project", "project.id"]:
                continue
            if field == "issue":
                field = FIELD_ALIASES["issue"]["column_alias"]
            # Note that because orderby shouldn't be an array field its not included in the values
            values = list(
                {
                    event.get(field)
                    for event in top_events["data"]
                    if field in event and not isinstance(event.get(field), list)
                }
            )
            if values:
                # timestamp needs special handling, creating a big OR instead
                if field == "timestamp":
                    snuba_filter.conditions.append([["timestamp", "=", value] for value in values])
                elif None in values:
                    non_none_values = [value for value in values if value is not None]
                    condition = [[["isNull", [resolve_discover_column(field)]], "=", 1]]
                    if non_none_values:
                        condition.append([resolve_discover_column(field), "IN", non_none_values])
                    snuba_filter.conditions.append(condition)
                else:
                    snuba_filter.conditions.append([resolve_discover_column(field), "IN", values])

    with sentry_sdk.start_span(op="discover.discover", description="top_events.snuba_query"):
        result = raw_query(
            aggregations=snuba_filter.aggregations,
            conditions=snuba_filter.conditions,
            filter_keys=snuba_filter.filter_keys,
            selected_columns=snuba_filter.selected_columns,
            start=snuba_filter.start,
            end=snuba_filter.end,
            rollup=rollup,
            orderby="time",
            groupby=["time"] + snuba_filter.groupby,
            dataset=Dataset.Discover,
            limit=10000,
            referrer=referrer,
        )

    with sentry_sdk.start_span(
        op="discover.discover", description="top_events.transform_results"
    ) as span:
        span.set_data("result_count", len(result.get("data", [])))
        result = transform_results(result, translated_columns, snuba_filter, selected_columns)

        translated_columns["project_id"] = "project"
        translated_groupby = [
            translated_columns.get(groupby, groupby) for groupby in snuba_filter.groupby
        ]

        issues = {}
        if "issue" in selected_columns:
            issues = Group.issues_mapping(
                set([event["issue.id"] for event in top_events["data"]]),
                params["project_id"],
                organization,
            )
        # so the result key is consistent
        translated_groupby.sort()

        results = {}
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
        for key, item in six.iteritems(results):
            results[key] = SnubaTSResult(
                {
                    "data": zerofill(
                        item["data"], snuba_filter.start, snuba_filter.end, rollup, "time"
                    ),
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
            tag = u"tags[{}]".format(tag_name)
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
