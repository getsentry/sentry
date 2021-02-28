from sentry.utils.snuba import (
    # Dataset,
    # get_measurement_name,
    naiveify_datetime,
    raw_query,
    # resolve_snuba_aliases,
    # resolve_column,
    # SNUBA_AND,
    # SNUBA_OR,
    SnubaTSResult,
    to_naive_timestamp,
)
from sentry.snuba.dataset import Dataset
from sentry_relay import DataCategory

# from .discover import zerofill


ERROR_DATA_CATEGORIES = [DataCategory.DEFAULT, DataCategory.ERROR, DataCategory.SECURITY]


def query(groupby, start, end, rollup, aggregations, orderby, fields=None, filter_keys=None):

    # if roll up >= use hourly, else use raw
    # add spanzzz
    result = raw_query(
        start=start,
        end=end,
        groupby=groupby,
        # conditions=conditions,
        aggregations=aggregations,
        rollup=rollup,
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

    result = zerofill(result["data"], start, end, rollup, "timestamp")
    return SnubaTSResult({"data": result}, start, end, rollup)


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
