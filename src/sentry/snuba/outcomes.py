from sentry.utils.snuba import (
    raw_query,
)
from sentry.snuba.dataset import Dataset
from sentry_relay import DataCategory


def query(groupby, start, end, rollup, aggregations, orderby, fields=None, filter_keys=None):

    # TODO: if roll up >= use hourly, else use raw
    # add spans
    result = raw_query(
        start=start,
        end=end,
        groupby=groupby,
        aggregations=aggregations,
        rollup=rollup,
        filter_keys=filter_keys,
        orderby=orderby,
        dataset=Dataset.Outcomes,
    )

    for row in result["data"]:
        row["category"] = (
            DataCategory.ERROR
            if row["category"] in DataCategory.error_categories()
            else DataCategory(row["category"])
        )
    return result["data"]
