from sentry.utils.snuba import (
    # Dataset,
    # get_measurement_name,
    # naiveify_datetime,
    raw_query,
    # resolve_snuba_aliases,
    # resolve_column,
    # SNUBA_AND,
    # SNUBA_OR,
    # SnubaTSResult,
    # to_naive_timestamp,
)
from sentry.snuba.dataset import Dataset


def query(groupby, start, end, rollup, aggregations, orderby, fields=None, filter_keys=None):

    # if roll up >= use hourly, else use raw
    # add spanzzz
    result = raw_query(
        start=start,
        end=end,
        groupby=groupby,
        # conditions=conditions,
        aggregations=aggregations,
        # selected_columns=fields,
        filter_keys=filter_keys,
        # having=snuba_filter.having,
        orderby=orderby,
        dataset=Dataset.Outcomes,
        # limit=limit,
        # offset=offset,
        # referrer=referrer,
    )

    # add logic for grouping datacategories as errors here
    #

    return result


# def get_outcomes_for_org_stats(
#     start,
#     end,
#     rollup,
#     org_id,
#     groupby_projects=False,
# ):
#     groupby = ["category", "timestamp"]
#     if groupby_projects is True:
#         groupby.append("project_id")

#     result = raw_query(
#         start=start,
#         end=end,
#         groupby=groupby,
#         # conditions=conditions,
#         aggregations=[["sum", "times_seen", "times_seen"], ["sum", "quantity", "quantity"]],
#         selected_columns=None,
#         filter_keys={"org_id": [org_id]},
#         # having=snuba_filter.having,
#         orderby=["times_seen", "-timestamp"],
#         dataset=Dataset.Outcomes,
#         # limit=limit,
#         # offset=offset,
#         # referrer=referrer,
#     )

#     return result
