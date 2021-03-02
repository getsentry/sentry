from sentry.utils.snuba import (
    # Dataset,
    # get_measurement_name,
    naiveify_datetime,
    raw_query,
    # resolve_snuba_aliases,
    # resolve_column,
    # SNUBA_AND,
    # SNUBA_OR,
    # SnubaTSResult,
    to_naive_timestamp,
)
from sentry.snuba.dataset import Dataset
from sentry_relay import DataCategory
from collections import defaultdict

# from sentry.utils.outcomes import Outcome

# from .discover import zerofill


def group_timestamps(result, groupby):
    tranformed_results = {}
    # input: {'project_id': 5, 'category': 1, 'time': 1614470400, 'times_seen': 8, 'quantity': 8}
    # should i be worried about dictorder?
    # output:
    # {'project_id': 5, "errors": { 'times_seen': 8, 'quantity': 8} 'time': 1614470400,} "transactions"
    grouping_key = groupby.copy()
    if "category" in grouping_key:
        grouping_key.remove("category")
    for row in result:
        row["category"] = (
            DataCategory.ERROR
            if row["category"] in DataCategory.error_categories()
            else DataCategory(row["category"])
        )
        uniq_key = "-".join([str(row[gb]) for gb in grouping_key])
        parsed_dc = DataCategory(row["category"]).api_name()
        if uniq_key in tranformed_results:
            if parsed_dc in tranformed_results[uniq_key]:
                tranformed_results[uniq_key][parsed_dc]["quantity"] += row["quantity"]
                tranformed_results[uniq_key][parsed_dc]["times_seen"] += row["times_seen"]
            else:
                tranformed_results[uniq_key][parsed_dc] = {
                    "quantity": row["quantity"],
                    "times_seen": row["times_seen"],
                }
        else:
            tranformed_results[uniq_key] = {field: row[field] for field in grouping_key}
            tranformed_results[uniq_key][parsed_dc] = {
                "quantity": row["quantity"],
                "times_seen": row["times_seen"],
            }

    result = list(tranformed_results.values())
    return result


def group_by_project(result):
    ret_results = defaultdict(list)
    for row in result:
        proj_id = row["project_id"]
        del row["project_id"]
        ret_results[proj_id].append(row)
    return ret_results


def query(groupby, start, end, rollup, aggregations, orderby, fields=None, filter_keys=None):

    # if roll up >= use hourly, else use raw
    # add spanzzz
    # what about sessions?
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

    for row in result["data"]:
        row["category"] = (
            DataCategory.ERROR
            if row["category"] in DataCategory.error_categories()
            else DataCategory(row["category"])
        )
    result = result["data"]

    return zerofill(result, start, end, rollup, "time")


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
