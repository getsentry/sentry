from sentry.db.models.fields.jsonfield import JSONField
from sentry.discover.arithmetic import is_equation
from sentry.discover.models import DiscoverSavedQuery
from sentry.discover.translation.mep_to_eap import (
    QueryParts,
    translate_columns,
    translate_mep_to_eap,
)
from sentry.explore.models import ExploreSavedQuery
from sentry.integrations.slack.unfurl.discover import is_aggregate


def _translate_discover_query_field_to_explore_query_schema(query: JSONField) -> JSONField:

    conditions = query.get("query", "")
    fields = query.get("fields", [])
    orderby = query.get("orderby", "")

    translated_query_parts = translate_mep_to_eap(
        QueryParts(
            selected_columns=fields,
            query=conditions,
            equations=None,
            orderby=orderby if type(orderby) is list else [orderby],
        )
    )

    aggregate_fields = [
        field for field in translated_query_parts["selected_columns"] if is_aggregate(field)
    ]

    # discover group by is all the fields that are not aggregates or equations
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

    y_axes = translate_columns([yaxis for yaxis in query.get("yAxis", [])])
    visualize = [{"chartType": chart_type, "yAxes": y_axes}]

    query_list = [
        {
            "query": translated_query_parts["query"],
            "fields": translated_query_parts["selected_columns"],
            "orderby": translated_query_parts["orderby"][0],
            "groupby": groupby,
            "mode": mode,
            "visualize": visualize,
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
