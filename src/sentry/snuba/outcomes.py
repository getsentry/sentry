from sentry.utils.snuba import (
    raw_query,
)
from sentry.snuba.dataset import Dataset
from sentry_relay import DataCategory
from .discover import zerofill
from collections import defaultdict
from sentry.api.utils import get_date_range_rollup_from_params


def group_by_project(result):
    ret_results = defaultdict(list)
    for row in result:
        proj_id = row["project_id"]
        del row["project_id"]
        ret_results[proj_id].append(row)
    return ret_results


def coalesce_error_categories(rows):
    for row in rows:
        row["category"] = (
            DataCategory.ERROR
            if row["category"] in DataCategory.error_categories()
            else DataCategory(row["category"])
        )
    return rows


def _outcomes_dataset(rollup):
    if rollup >= 3600:
        # Outcomes is the hourly rollup table
        return Dataset.Outcomes
    else:
        return Dataset.OutcomesRaw


def query(groupby, aggregations, orderby, request, filter_keys=None):

    # TODO: if roll up >= 1hr use hourly, else use raw
    # TODO: add rollup constraint here
    # add spans
    start, end, rollup = get_date_range_rollup_from_params(
        request, minimum_interval="10s", default_interval="1h", round_range=True
    )
    result = raw_query(
        start=start,
        end=end,
        groupby=groupby,
        aggregations=aggregations,
        rollup=rollup,
        filter_keys=filter_keys,
        orderby=orderby,
        dataset=_outcomes_dataset(rollup),
    )

    result = coalesce_error_categories(result["data"])
    # TODO: group by category too?
    if "project_id" in groupby:
        result = {
            project_id: zerofill(rows, start, end, rollup, "time")
            for project_id, rows in group_by_project(result).items()
        }
    else:
        result = zerofill(result, start, end, rollup, "time")

    return result
