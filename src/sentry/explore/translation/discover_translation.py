import re
from typing import Any

from sentry.discover.arithmetic import is_equation
from sentry.discover.models import DiscoverSavedQuery
from sentry.discover.translation.mep_to_eap import (
    QueryParts,
    translate_columns,
    translate_mep_to_eap,
)
from sentry.explore.models import ExploreSavedQuery
from sentry.integrations.slack.unfurl.discover import is_aggregate


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
    columns = [field for field in fields if not is_equation(field)]
    equations = [field for field in fields if is_equation(field)]
    # orderby functions can be formated like -count_unique_user_id for count_unique(user.id)
    # this does not apply to fields and equations
    orderby = query.get("orderby", "")
    # need to make sure all orderby functions are in the correct format
    orderby_converted_list = _format_orderby_for_translation(orderby, columns)

    translated_query_parts = translate_mep_to_eap(
        QueryParts(
            selected_columns=fields,
            query=conditions,
            equations=equations,
            orderby=orderby_converted_list,
        )
    )

    aggregate_fields = [
        field for field in translated_query_parts["selected_columns"] if is_aggregate(field)
    ]

    # TODO: if it is in aggregate mode we need to fill out aggregateField which is an array of
    # {groupBy: name} or {yAxes: [name], chartType: type}
    # IF not in aggregate mode we need to fill out `fields` array

    # discover group by is all the fields that are not aggregates or equations
    # this should go after finding out display type
    groupby = [
        field
        for field in translated_query_parts["selected_columns"]
        if not (is_aggregate(field) or is_equation(field))
    ]
    if len(aggregate_fields) > 0:
        mode = "aggregate"
    else:
        # if we're in samples mode we don't need a group by
        mode = "samples"
        groupby = []

    display = query.get("display", "default")
    interval = None

    match display:
        case "default":
            chart_type = "area"
        case "previous":
            chart_type = "area"
        case "top5":
            # don't need to update group by because we cannot have top5 without an aggregate
            chart_type = "area"
        case "daily":
            chart_type = "bar"
            interval = "1d"
        case "dailytop5":
            chart_type = "area"
            interval = "1d"
        case "bar":
            chart_type = "bar"
        case _:
            chart_type = "area"

    # yAxis can be equations too
    y_axes = translate_columns([yaxis for yaxis in query.get("yAxis", [])])
    # double check this to make sure it's right
    visualize = [{"chartType": chart_type, "yAxes": y_axes}]

    query_list = [
        {
            "query": translated_query_parts["query"],
            "fields": translated_query_parts["selected_columns"],
            "orderby": (
                translated_query_parts["orderby"][0]
                if len(translated_query_parts["orderby"]) > 0
                else None
            ),
            "groupby": groupby,
            "mode": mode,
            "visualize": visualize,  # this should no longer be used, now we have aggregateField
            # aggregateField: []
            #
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
        dataset=101,
        is_multi_query=False,
        organization=discover_query.organization,
        name=discover_query.name,
        query=translated_query_field,
    )

    return new_explore_query
