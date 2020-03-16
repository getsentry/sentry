from __future__ import absolute_import

import six

from collections import namedtuple
from copy import deepcopy
from datetime import timedelta

from sentry import options
from sentry.api.event_search import (
    get_filter,
    get_function_alias,
    is_function,
    resolve_field_list,
    InvalidSearchQuery,
    FIELD_ALIASES,
)

from sentry import eventstore

from sentry.models import Project, ProjectStatus
from sentry.tagstore.base import TOP_VALUES_DEFAULT_LIMIT
from sentry.utils.snuba import (
    Dataset,
    SnubaTSResult,
    DISCOVER_COLUMN_MAP,
    QUOTED_LITERAL_RE,
    raw_query,
    to_naive_timestamp,
    naiveify_datetime,
    resolve_condition,
)

__all__ = (
    "ReferenceEvent",
    "PaginationResult",
    "InvalidSearchQuery",
    "create_reference_event_conditions",
    "query",
    "timeseries_query",
    "get_pagination_ids",
    "get_facets",
    "transform_results",
    "zerofill",
)


ReferenceEvent = namedtuple("ReferenceEvent", ["organization", "slug", "fields", "start", "end"])
ReferenceEvent.__new__.__defaults__ = (None, None)

PaginationResult = namedtuple("PaginationResult", ["next", "previous", "oldest", "latest"])
FacetResult = namedtuple("FacetResult", ["key", "value", "count"])


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
        raise InvalidSearchQuery("Invalid reference event")

    column_names = [resolve_column(col) for col in reference_event.fields if is_real_column(col)]
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
        raise InvalidSearchQuery("Invalid reference event")

    start = None
    end = None
    if reference_event.start:
        start = reference_event.start - timedelta(seconds=5)
    if reference_event.end:
        end = reference_event.end + timedelta(seconds=5)

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
        raise InvalidSearchQuery("Invalid reference event")

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

    field_names = [resolve_column(col) for col in reference_event.fields]
    for (i, field) in enumerate(reference_event.fields):
        value = event_data.get(field_names[i], None)
        # If the value is a sequence use the first element as snuba
        # doesn't support `=` or `IN` operations on fields like exception_frames.filename
        if isinstance(value, (list, set)) and value:
            value = value.pop()
        if value:
            conditions.append([field, "=", value])

    return conditions


def resolve_column(col):
    """
    Used as a column resolver in discover queries.

    Resolve a public schema name to the discover dataset.
    unknown columns are converted into tags expressions.
    """
    if col is None:
        return col
    # Whilst project_id is not part of the public schema we convert
    # the project.name field into project_id way before we get here.
    if col == "project_id":
        return col
    if col.startswith("tags[") or QUOTED_LITERAL_RE.match(col):
        return col
    return DISCOVER_COLUMN_MAP.get(col, u"tags[{}]".format(col))


def resolve_discover_aliases(snuba_args):
    """
    Resolve the public schema aliases to the discover dataset.

    Returns a copy of the input structure, and includes a
    `translated_columns` key containing the selected fields that need to
    be renamed in the result set.
    """
    resolved = deepcopy(snuba_args)
    translated_columns = {}
    derived_columns = set()

    selected_columns = resolved.get("selected_columns")
    if selected_columns:
        for (idx, col) in enumerate(selected_columns):
            if isinstance(col, (list, tuple)):
                raise ValueError("discover selected_columns should only be str. got %s" % col)
            name = resolve_column(col)
            selected_columns[idx] = name
            translated_columns[name] = col
        resolved["selected_columns"] = selected_columns

    groupby = resolved.get("groupby")
    if groupby:
        for (idx, col) in enumerate(groupby):
            name = col
            if col not in derived_columns:
                name = resolve_column(col)
            groupby[idx] = name
        resolved["groupby"] = groupby

    aggregations = resolved.get("aggregations")
    for aggregation in aggregations or []:
        derived_columns.add(aggregation[2])
        if isinstance(aggregation[1], six.string_types):
            aggregation[1] = resolve_column(aggregation[1])
        elif isinstance(aggregation[1], (set, tuple, list)):
            aggregation[1] = [resolve_column(col) for col in aggregation[1]]
    resolved["aggregations"] = aggregations

    conditions = resolved.get("conditions")
    if conditions:
        for (i, condition) in enumerate(conditions):
            replacement = resolve_condition(condition, resolve_column)
            conditions[i] = replacement
        resolved["conditions"] = [c for c in conditions if c]

    # TODO add support for extracting having conditions.

    orderby = resolved.get("orderby")
    if orderby:
        orderby = orderby if isinstance(orderby, (list, tuple)) else [orderby]
        resolved_orderby = []

        for field_with_order in orderby:
            field = field_with_order.lstrip("-")
            resolved_orderby.append(
                u"{}{}".format(
                    "-" if field_with_order.startswith("-") else "",
                    field if field in derived_columns else resolve_column(field),
                )
            )
        resolved["orderby"] = resolved_orderby
    return resolved, translated_columns


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


def transform_results(result, translated_columns, snuba_args):
    """
    Transform internal names back to the public schema ones.

    When getting timeseries results via rollup, this function will
    zerofill the output results.
    """
    # Translate back columns that were converted to snuba format
    for col in result["meta"]:
        col["name"] = translated_columns.get(col["name"], col["name"])

    def get_row(row):
        return {translated_columns.get(key, key): value for key, value in row.items()}

    if len(translated_columns):
        result["data"] = [get_row(row) for row in result["data"]]

    rollup = snuba_args.get("rollup")
    if rollup and rollup > 0:
        result["data"] = zerofill(
            result["data"], snuba_args["start"], snuba_args["end"], rollup, snuba_args["orderby"]
        )

    return result


# TODO(evanh) This is only here for backwards compatibilty with old queries using these deprecated
# aliases. Once we migrate the queries these can go away.
OLD_FUNCTIONS_TO_NEW = {
    "p75": "percentile(transaction.duration, 0.75)",
    "p95": "percentile(transaction.duration, 0.95)",
    "p99": "percentile(transaction.duration, 0.99)",
    "last_seen": "last_seen()",
    "latest_event": "latest_event()",
    "apdex": "apdex(transaction.duration, 300)",
    "impact": "impact(transaction.duration, 300)",
}


def transform_deprecated_functions_in_columns(columns):
    new_list = []
    translations = {}
    for column in columns:
        if column in OLD_FUNCTIONS_TO_NEW:
            new_column = OLD_FUNCTIONS_TO_NEW[column]
            translations[get_function_alias(new_column)] = column
            new_list.append(new_column)
        elif column.replace("()", "") in OLD_FUNCTIONS_TO_NEW:
            new_column = OLD_FUNCTIONS_TO_NEW[column.replace("()", "")]
            translations[get_function_alias(new_column)] = column.replace("()", "")
            new_list.append(new_column)
        else:
            new_list.append(column)

    return new_list, translations


def transform_deprecated_functions_in_orderby(orderby):
    if not orderby:
        return

    orderby = orderby if isinstance(orderby, (list, tuple)) else [orderby]
    new_orderby = []
    for order in orderby:
        has_negative = False
        column = order
        if order.startswith("-"):
            has_negative = True
            column = order.strip("-")

        new_column = column
        if column in OLD_FUNCTIONS_TO_NEW:
            new_column = get_function_alias(OLD_FUNCTIONS_TO_NEW[column])
        elif column.replace("()", "") in OLD_FUNCTIONS_TO_NEW:
            new_column = get_function_alias(OLD_FUNCTIONS_TO_NEW[column.replace("()", "")])

        if has_negative:
            new_column = "-" + new_column

        new_orderby.append(new_column)

    return new_orderby


def transform_deprecated_functions_in_query(query):
    if query is None:
        return query

    for old_function in OLD_FUNCTIONS_TO_NEW:
        if old_function + "()" in query:
            replacement = OLD_FUNCTIONS_TO_NEW[old_function]
            query = query.replace(old_function + "()", replacement)
        elif old_function in query:
            replacement = OLD_FUNCTIONS_TO_NEW[old_function]
            query = query.replace(old_function, replacement)

    return query


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

    # TODO(evanh): These can be removed once we migrate the frontend / saved queries
    # to use the new function values
    selected_columns, function_translations = transform_deprecated_functions_in_columns(
        selected_columns
    )
    orderby = transform_deprecated_functions_in_orderby(orderby)
    query = transform_deprecated_functions_in_query(query)

    snuba_filter = get_filter(query, params)

    # TODO(mark) Refactor the need for this translation shim once all of
    # discover is using this module. Remember to update all the functions
    # in this module.
    snuba_args = {
        "start": snuba_filter.start,
        "end": snuba_filter.end,
        "conditions": snuba_filter.conditions,
        "filter_keys": snuba_filter.filter_keys,
        "orderby": orderby,
        "having": [],
    }

    if use_aggregate_conditions:
        snuba_args["having"] = snuba_filter.having

    snuba_args.update(
        resolve_field_list(selected_columns, snuba_args, params=params, auto_fields=auto_fields)
    )

    if reference_event:
        ref_conditions = create_reference_event_conditions(reference_event)
        if ref_conditions:
            snuba_args["conditions"].extend(ref_conditions)

    # Resolve the public aliases into the discover dataset names.
    snuba_args, translated_columns = resolve_discover_aliases(snuba_args)
    for snuba_name, sentry_name in six.iteritems(function_translations):
        translated_columns[snuba_name] = sentry_name

    # Make sure that any aggregate conditions are also in the selected columns
    for having_clause in snuba_args.get("having"):
        found = any(
            having_clause[0] == agg_clause[-1] for agg_clause in snuba_args.get("aggregations")
        )
        if not found:
            raise InvalidSearchQuery(
                u"Aggregate {} used in a condition but is not a selected column.".format(
                    having_clause[0]
                )
            )

    if conditions is not None:
        snuba_args["conditions"].extend(conditions)

    result = raw_query(
        start=snuba_args.get("start"),
        end=snuba_args.get("end"),
        groupby=snuba_args.get("groupby"),
        conditions=snuba_args.get("conditions"),
        aggregations=snuba_args.get("aggregations"),
        selected_columns=snuba_args.get("selected_columns"),
        filter_keys=snuba_args.get("filter_keys"),
        having=snuba_args.get("having"),
        orderby=snuba_args.get("orderby"),
        dataset=Dataset.Discover,
        limit=limit,
        offset=offset,
        referrer=referrer,
    )

    return transform_results(result, translated_columns, snuba_args)


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
    # TODO(evanh): These can be removed once we migrate the frontend / saved queries
    # to use the new function values
    selected_columns, _ = transform_deprecated_functions_in_columns(selected_columns)
    query = transform_deprecated_functions_in_query(query)

    snuba_filter = get_filter(query, params)
    snuba_args = {
        "start": snuba_filter.start,
        "end": snuba_filter.end,
        "conditions": snuba_filter.conditions,
        "filter_keys": snuba_filter.filter_keys,
        "having": snuba_filter.having,
    }
    if not snuba_args["start"] and not snuba_args["end"]:
        raise InvalidSearchQuery("Cannot get timeseries result without a start and end.")

    snuba_args.update(resolve_field_list(selected_columns, snuba_args, auto_fields=False))
    if reference_event:
        ref_conditions = create_reference_event_conditions(reference_event)
        if ref_conditions:
            snuba_args["conditions"].extend(ref_conditions)

    # Resolve the public aliases into the discover dataset names.
    snuba_args, _ = resolve_discover_aliases(snuba_args)
    if not snuba_args["aggregations"]:
        raise InvalidSearchQuery("Cannot get timeseries result with no aggregation.")

    # Change the alias of the first aggregation to count. This ensures compatibility
    # with other parts of the timeseries endpoint expectations
    if len(snuba_args["aggregations"]) == 1:
        snuba_args["aggregations"][0][2] = "count"

    result = raw_query(
        aggregations=snuba_args.get("aggregations"),
        conditions=snuba_args.get("conditions"),
        filter_keys=snuba_args.get("filter_keys"),
        start=snuba_args.get("start"),
        end=snuba_args.get("end"),
        rollup=rollup,
        orderby="time",
        groupby=["time"],
        dataset=Dataset.Discover,
        limit=10000,
        referrer=referrer,
    )
    result = zerofill(result["data"], snuba_args["start"], snuba_args["end"], rollup, "time")

    return SnubaTSResult({"data": result}, snuba_filter.start, snuba_filter.end, rollup)


def get_id(result):
    if result:
        return result[1]


def get_pagination_ids(event, query, params, organization, reference_event=None, referrer=None):
    """
    High-level API for getting pagination data for an event + filter

    The provided event is used as a reference event to find events
    that are older and newer than the current one.

    event (Event) The event to find related events for.
    query (str) Filter query string to create conditions from.
    params (Dict[str, str]) Filtering parameters with start, end, project_id, environment,
    reference_event (ReferenceEvent) A reference event object. Used to generate additional
                                    conditions based on the provided reference.
    referrer (str|None) A referrer string to help locate the origin of this query.
    """
    # TODO(evanh): This can be removed once we migrate the frontend / saved queries
    # to use the new function values
    query = transform_deprecated_functions_in_query(query)

    snuba_filter = get_filter(query, params)

    if reference_event:
        ref_conditions = create_reference_event_conditions(reference_event)
        if ref_conditions:
            snuba_filter.conditions.extend(ref_conditions)

    result = {
        "next": eventstore.get_next_event_id(event, filter=snuba_filter),
        "previous": eventstore.get_prev_event_id(event, filter=snuba_filter),
        "latest": eventstore.get_latest_event_id(event, filter=snuba_filter),
        "oldest": eventstore.get_earliest_event_id(event, filter=snuba_filter),
    }

    # translate project ids to slugs

    project_ids = set([tuple[0] for tuple in result.values() if tuple])

    project_slugs = {}
    projects = Project.objects.filter(
        id__in=list(project_ids), organization=organization, status=ProjectStatus.VISIBLE
    ).values("id", "slug")

    for project in projects:
        project_slugs[project["id"]] = project["slug"]

    def into_pagination_record(project_slug_event_id):

        if not project_slug_event_id:
            return None

        project_id = int(project_slug_event_id[0])

        return "{}:{}".format(project_slugs[project_id], project_slug_event_id[1])

    for key, value in result.items():
        result[key] = into_pagination_record(value)

    return PaginationResult(**result)


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
    # TODO(evanh): This can be removed once we migrate the frontend / saved queries
    # to use the new function values
    query = transform_deprecated_functions_in_query(query)

    snuba_filter = get_filter(query, params)

    # TODO(mark) Refactor the need for this translation shim.
    snuba_args = {
        "start": snuba_filter.start,
        "end": snuba_filter.end,
        "conditions": snuba_filter.conditions,
        "filter_keys": snuba_filter.filter_keys,
    }
    # Resolve the public aliases into the discover dataset names.
    snuba_args, translated_columns = resolve_discover_aliases(snuba_args)

    # Exclude tracing tags as they are noisy and generally not helpful.
    excluded_tags = ["tags_key", "NOT IN", ["trace", "trace.ctx", "trace.span", "project"]]

    # Sampling keys for multi-project results as we don't need accuracy
    # with that much data.
    sample = len(snuba_filter.filter_keys["project_id"]) > 2

    # Get the most frequent tag keys
    key_names = raw_query(
        aggregations=[["count", None, "count"]],
        start=snuba_args.get("start"),
        end=snuba_args.get("end"),
        conditions=snuba_args.get("conditions"),
        filter_keys=snuba_args.get("filter_keys"),
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
    sample_rate = 0.1 if key_names["data"][0]["count"] > 10000 else None
    # Rescale the results if we're sampling
    multiplier = 1 / sample_rate if sample_rate is not None else 1

    fetch_projects = False
    if len(params.get("project_id", [])) > 1:
        if len(top_tags) == limit:
            top_tags.pop()
        fetch_projects = True

    results = []
    if fetch_projects:
        project_values = raw_query(
            aggregations=[["count", None, "count"]],
            start=snuba_args.get("start"),
            end=snuba_args.get("end"),
            conditions=snuba_args.get("conditions"),
            filter_keys=snuba_args.get("filter_keys"),
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

    for tag_name in individual_tags:
        tag = u"tags[{}]".format(tag_name)
        tag_values = raw_query(
            aggregations=[["count", None, "count"]],
            conditions=snuba_args.get("conditions"),
            start=snuba_args.get("start"),
            end=snuba_args.get("end"),
            filter_keys=snuba_args.get("filter_keys"),
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
        conditions = snuba_args.get("conditions", [])
        conditions.append(["tags_key", "IN", aggregate_tags])
        tag_values = raw_query(
            aggregations=[["count", None, "count"]],
            conditions=conditions,
            start=snuba_args.get("start"),
            end=snuba_args.get("end"),
            filter_keys=snuba_args.get("filter_keys"),
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
