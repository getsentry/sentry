import re
from typing import Any

from sentry.discover.arithmetic import is_equation
from sentry.discover.models import DiscoverSavedQuery
from sentry.discover.translation.mep_to_eap import QueryParts, translate_mep_to_eap
from sentry.explore.models import ExploreSavedQuery, ExploreSavedQueryDataset
from sentry.integrations.slack.unfurl.discover import is_aggregate

# we're going to keep the chart types from discover
# bar = 0, line = 1, area = 2
CHART_TYPES = {
    "default": 2,
    "previous": 2,
    "top5": 2,
    "daily": 0,
    "dailytop5": 2,
    "bar": 0,
}


def _get_translated_orderby_item(orderby, columns, is_negated):
    """
    This function is used to translate the function underscore notation for orderby items
    to regular function notation. We do this by stripping both the orderby item and the given columns
    (which could be functions and fields) and then checking if it matches up to any of those stripped columns.
    """
    columns_stripped_list = [re.sub(r"^[.()_]+", "", column) for column in columns]
    joined_orderby_item = re.sub(r"^[.()_]+", "", orderby)
    if joined_orderby_item in columns_stripped_list:
        try:
            field_orderby_index = columns_stripped_list.index(joined_orderby_item)
            converted_orderby_item = columns[field_orderby_index]
            if is_negated:
                converted_orderby_item = f"-{converted_orderby_item}"
            return converted_orderby_item
        except ValueError:
            # if the orderby item is not in the columns, it should be dropped anyways
            return None
    # if the orderby item is not a field it should be dropped anyways
    else:
        return None


def _format_orderby_for_translation(orderby, columns):
    orderby_converted_list = []
    if type(orderby) is list:
        for orderby_item in orderby:
            stripped_orderby_item = orderby_item
            is_negated = False
            if orderby_item.startswith("-"):
                is_negated = True
                stripped_orderby_item = stripped_orderby_item[1:]
            # equation orderby is always formatted like regular equations
            if is_equation(stripped_orderby_item):
                orderby_converted_list.append(orderby_item)
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
        stripped_orderby_item = orderby
        is_negated = False
        if orderby.startswith("-"):
            is_negated = True
            stripped_orderby_item = stripped_orderby_item[1:]
        translated_orderby_item = _get_translated_orderby_item(
            stripped_orderby_item, columns, is_negated
        )
        if translated_orderby_item is not None:
            orderby_converted_list.append(translated_orderby_item)

    return orderby_converted_list


def _translate_discover_query_field_to_explore_query_schema(
    query: dict[str, Any],
) -> dict[str, Any]:

    conditions = query.get("query", "")
    # have to separate equations and fields
    fields = query.get("fields", [])
    yAxis_fields = query.get("yAxis", [])
    # some yAxis fields can be a single string
    visualized_fields = yAxis_fields if type(yAxis_fields) is list else [yAxis_fields]
    # in explore there is no concept of chart only (yaxis) fields or table only fields,
    # so we're just adding all the fields into the columns/equations lists
    columns = [field for field in fields if not is_equation(field)] + [
        field for field in visualized_fields if not is_equation(field)
    ]
    equations = [field for field in fields if is_equation(field)] + [
        field for field in visualized_fields if is_equation(field)
    ]

    orderby = query.get("orderby", "")
    # need to make sure all orderby functions are in the correct format (i.e. not in -count_unique_user_id format)
    orderby_converted_list = _format_orderby_for_translation(orderby, columns)

    translated_query_parts = translate_mep_to_eap(
        QueryParts(
            selected_columns=columns,
            query=conditions,
            equations=equations,
            orderby=orderby_converted_list,
        )
    )

    translated_aggregate_columns = (
        [field for field in translated_query_parts["selected_columns"] if is_aggregate(field)]
        if translated_query_parts["selected_columns"] is not None
        else []
    )

    translated_non_aggregate_columns = (
        [field for field in translated_query_parts["selected_columns"] if not is_aggregate(field)]
        if translated_query_parts["selected_columns"] is not None
        else []
    )

    translated_equations = (
        [field for field in translated_query_parts["equations"]]
        if translated_query_parts["equations"] is not None
        else []
    )

    # if we have any aggregates or equation we should be in aggregate mode
    if len(translated_aggregate_columns) > 0 or len(translated_equations) > 0:
        mode = "aggregate"
    else:
        mode = "samples"

    display = query.get("display", "default")
    interval = None

    chart_type = CHART_TYPES[display]
    # only intervals that matter are the daily ones, rest can be defaulted to explore default
    if display in ["daily", "dailytop5"]:
        interval = "1d"

    y_axes = translated_aggregate_columns + translated_equations
    # aggregate fields parameter contains groupBys and yAxes
    aggregate_fields = [
        {"groupBy": translated_column} for translated_column in translated_non_aggregate_columns
    ] + [{"yAxes": [y_axis], "chartType": chart_type} for y_axis in y_axes]

    # we want to make sure the id field is always included in samples mode
    # because without it the 'id' field is not sortable on the samples table
    fields_with_id = (
        (["id"] + translated_non_aggregate_columns)
        if "id" not in translated_non_aggregate_columns
        else translated_non_aggregate_columns
    )

    query_list = [
        {
            "query": translated_query_parts["query"],
            "fields": fields_with_id,
            "orderby": (
                translated_query_parts["orderby"][0]
                if len(translated_query_parts["orderby"]) > 0 and mode == "samples"
                else None
            ),
            "mode": mode,
            "aggregateField": aggregate_fields,
            "aggregateOrderby": (
                translated_query_parts["orderby"][0]
                if len(translated_query_parts["orderby"]) > 0 and mode == "aggregate"
                else None
            ),
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

    return explore_query


def translate_discover_query_to_explore_query(
    discover_query: DiscoverSavedQuery,
) -> ExploreSavedQuery:

    translated_query_field = _translate_discover_query_field_to_explore_query_schema(
        discover_query.query
    )

    new_explore_query = ExploreSavedQuery.objects.create(
        date_updated=discover_query.date_updated,
        date_added=discover_query.date_created,
        created_by_id=discover_query.created_by_id,
        visits=discover_query.visits,
        last_visited=discover_query.last_visited,
        dataset=ExploreSavedQueryDataset.SEGMENT_SPANS,
        is_multi_query=False,
        organization=discover_query.organization,
        name=discover_query.name,
        query=translated_query_field,
        # TODO: add changed_reason (after making updated to translation layer)
    )

    return new_explore_query
