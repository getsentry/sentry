import re
from typing import Any

from sentry.discover.arithmetic import is_equation
from sentry.discover.models import DiscoverSavedQuery
from sentry.discover.translation.mep_to_eap import (
    INDEXED_EQUATIONS_PATTERN,
    DroppedFields,
    QueryParts,
    translate_mep_to_eap,
)
from sentry.explore.models import ExploreSavedQuery, ExploreSavedQueryDataset
from sentry.integrations.slack.unfurl.discover import is_aggregate
from sentry.search.events.fields import (
    get_function_alias_with_columns,
    is_function,
    parse_arguments,
)

# we're going to keep the chart types from discover
# bar = 0, line = 1, area = 2
CHART_TYPES = {
    "default": 2,
    "previous": 2,
    "top5": 2,
    "daily": 0,
    "dailytop5": 0,
    "bar": 0,
}


def strip_negative_from_orderby(orderby):
    """
    This function is used to strip the negative from an orderby item.
    """
    if orderby.startswith("-"):
        return orderby[1:], True
    return orderby, False


def _get_translated_orderby_item(orderby, columns, is_negated):
    """
    This function is used to translate the function underscore notation for orderby items
    to regular function notation. We do this by stripping both the orderby item and the given columns
    (which could be functions and fields) and then checking if it matches up to any of those stripped columns.
    """
    columns_underscore_list = []
    for column in columns:
        if (match := is_function(column)) is not None:
            aggregate, fields_string = match.group("function"), match.group("columns")
            fields = parse_arguments(aggregate, fields_string)
            columns_underscore_list.append(get_function_alias_with_columns(aggregate, fields))
        else:
            # non-function columns don't change format
            columns_underscore_list.append(column)
    joined_orderby_item = orderby
    if (match := is_function(orderby)) is not None:
        aggregate, fields_string = match.group("function"), match.group("columns")
        fields = parse_arguments(aggregate, fields_string)
        joined_orderby_item = get_function_alias_with_columns(aggregate, fields)

    converted_orderby = None
    for index, stripped_column in enumerate(columns_underscore_list):
        if joined_orderby_item == stripped_column:
            converted_orderby = columns[index]
            break

    if converted_orderby is None:
        # If it's not in the selected fields, just pass it down as is
        converted_orderby = orderby
    if is_negated:
        converted_orderby = f"-{converted_orderby}"
    return converted_orderby


def _format_orderby_for_translation(orderby, columns):
    orderby_converted_list = []
    if type(orderby) is str:
        orderby = [orderby]
    if type(orderby) is list:
        for orderby_item in orderby:
            stripped_orderby_item, is_negated = strip_negative_from_orderby(orderby_item)
            # equation orderby can be formatted in indexed format
            # (we will keep it in indexed format because the translation layer handles it)
            if re.match(INDEXED_EQUATIONS_PATTERN, stripped_orderby_item):
                orderby_converted_list.append(orderby_item)
            elif is_equation(stripped_orderby_item):
                orderby_converted_list.append(orderby_item)
            # if the orderby item is in the columns list it exists and is a field
            elif stripped_orderby_item in columns:
                orderby_converted_list.append(orderby_item)
            else:
                # orderby functions can be formated in all underscores like -count_unique_user_id for count_unique(user.id)
                # this does not apply to fields and equations
                translated_orderby_item = _get_translated_orderby_item(
                    stripped_orderby_item, columns, is_negated
                )
                if translated_orderby_item is not None:
                    orderby_converted_list.append(translated_orderby_item)
    else:
        return None

    return orderby_converted_list


def _translate_discover_query_field_to_explore_query_schema(
    query: dict[str, Any],
) -> tuple[dict[str, Any], DroppedFields]:
    conditions = query.get("query", "")
    # have to separate equations and fields
    fields = query.get("fields", [])
    yAxis_fields = query.get("yAxis", [])
    # some yAxis fields can be a single string
    visualized_fields = yAxis_fields if type(yAxis_fields) is list else [yAxis_fields]

    # in explore there is no concept of chart only (yaxis) fields or table only fields,
    # so we're just adding all the fields into the columns/equations lists
    base_fields = [field for field in fields if not is_equation(field)]
    # add visualized_fields that are not equations and not already in fields
    additional_visualized_fields = [
        field for field in visualized_fields if not is_equation(field) and field not in base_fields
    ]
    columns = base_fields + additional_visualized_fields

    # all equations in the visualized_fields have to be in the fields list
    equations = [field for field in fields if is_equation(field)]

    orderby = query.get("orderby", "")
    # need to make sure all orderby functions are in the correct format (i.e. not in -count_unique_user_id format)
    orderby_converted_list = _format_orderby_for_translation(orderby, columns)

    translated_query_parts, dropped_fields_from_translation = translate_mep_to_eap(
        QueryParts(
            selected_columns=columns,
            query=conditions,
            equations=equations,
            orderby=orderby_converted_list,
        )
    )

    # for certain functions, we translate them to equations because they're only supported in the explore equation builder

    translated_aggregate_columns = (
        [
            field
            for field in translated_query_parts["selected_columns"]
            if is_aggregate(field) or is_equation(field)
        ]
        if translated_query_parts["selected_columns"] is not None
        else []
    )

    translated_non_aggregate_columns = (
        [
            field
            for field in translated_query_parts["selected_columns"]
            if not is_aggregate(field) and not is_equation(field)
        ]
        if translated_query_parts["selected_columns"] is not None
        else []
    )

    translated_equations = (
        [field for field in translated_query_parts["equations"]]
        if translated_query_parts["equations"] is not None
        else []
    )

    display = query.get("display", "default")

    # if we have any aggregates or equation we should be in aggregate mode
    if len(translated_aggregate_columns) > 0 or len(translated_equations) > 0:
        # check for ones we can make to samples
        if display in ["top5", "dailytop5"]:
            mode = "aggregate"
        else:
            mode = "samples"
    else:
        mode = "samples"

    interval = None

    try:
        chart_type = CHART_TYPES[display]
    except KeyError:
        chart_type = CHART_TYPES["default"]
    # only intervals that matter are the daily ones, rest can be defaulted to explore default
    if display in ["daily", "dailytop5"]:
        interval = "1d"

    y_axes = translated_aggregate_columns + translated_equations
    # aggregate fields parameter contains groupBys (only if in aggregate mode) and yAxes.
    # group bys shouldn't include id or timestamp
    aggregate_fields = (
        [
            {"groupBy": translated_column}
            for translated_column in translated_non_aggregate_columns
            if translated_column not in ["id", "timestamp"]
        ]
        if mode == "aggregate"
        else []
    ) + [{"yAxes": [y_axis], "chartType": chart_type} for y_axis in y_axes]

    # we want to make sure the id field is always included in samples mode
    # because without it the 'id' field is not sortable on the samples table
    fields_with_id = (
        (["id"] + translated_non_aggregate_columns)
        if "id" not in translated_non_aggregate_columns
        else translated_non_aggregate_columns
    )

    if translated_query_parts["orderby"] is None or len(translated_query_parts["orderby"]) == 0:
        translated_orderby = None
        aggregate_orderby = None
    else:
        translated_orderby = translated_query_parts["orderby"][0]
        stripped_translated_orderby, is_negated = strip_negative_from_orderby(translated_orderby)
        if re.match(INDEXED_EQUATIONS_PATTERN, stripped_translated_orderby):
            try:
                translated_equation_index = int(
                    stripped_translated_orderby.split("[")[1].split("]")[0]
                )
                orderby_equation = translated_equations[translated_equation_index]
                # if the orderby is an equation there's only aggregate orderby
                translated_orderby = orderby_equation if not is_negated else f"-{orderby_equation}"
                aggregate_orderby = translated_orderby
            except (IndexError, ValueError):
                translated_orderby = None
                aggregate_orderby = None

        else:
            aggregate_orderby = (
                translated_orderby
                if is_aggregate(stripped_translated_orderby)
                or is_equation(stripped_translated_orderby)
                else None
            )

    query_list = [
        {
            "query": translated_query_parts["query"],
            "fields": fields_with_id,
            "orderby": (translated_orderby if aggregate_orderby is None else None),
            "mode": mode,
            "aggregateField": aggregate_fields,
            "aggregateOrderby": aggregate_orderby,
        }
    ]

    explore_query = {
        "environment": query.get("environment", []),
        "start": query.get("start", None),
        "end": query.get("end", None),
        "range": query.get("range", None),
        "interval": interval,
        "query": query_list,
    }

    return explore_query, dropped_fields_from_translation


def translate_discover_query_to_explore_query(
    discover_query: DiscoverSavedQuery,
) -> ExploreSavedQuery:
    translated_query_field, dropped_fields_from_translation = (
        _translate_discover_query_field_to_explore_query_schema(discover_query.query)
    )

    changed_reason = {
        "equations": dropped_fields_from_translation["equations"],
        "columns": dropped_fields_from_translation["selected_columns"],
        "orderby": dropped_fields_from_translation["orderby"],
    }

    create_defaults = {
        "date_updated": discover_query.date_updated,
        "date_added": discover_query.date_created,
        "created_by_id": discover_query.created_by_id,
        "visits": discover_query.visits,
        "last_visited": discover_query.last_visited,
        "dataset": ExploreSavedQueryDataset.SEGMENT_SPANS,
        "is_multi_query": False,
        "organization": discover_query.organization,
        "name": discover_query.name,
        "query": translated_query_field,
        "changed_reason": changed_reason,
    }

    if discover_query.explore_query is not None:
        discover_query.explore_query.changed_reason = changed_reason
        discover_query.explore_query.query = translated_query_field
        discover_query.explore_query.save()
        new_explore_query = discover_query.explore_query
    else:
        new_explore_query = ExploreSavedQuery(**create_defaults)
        new_explore_query.save()
        discover_query.explore_query_id = new_explore_query.id
        discover_query.save()

    return new_explore_query
