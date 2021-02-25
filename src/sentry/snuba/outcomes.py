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


def query(filters, group_by, start, end, rollup, aggregations, fields=None):
    # add logic for grouping datacategories as errors
    # if roll up >= use hourly, else use raw
    result = raw_query(
        start=start,
        end=end,
        groupby=group_by,
        # conditions=conditions,
        aggregations=aggregations,
        selected_columns=fields,
        filter_keys=filters,
        # having=snuba_filter.having,
        orderby=["-timestamp"],
        dataset=Dataset.Outcomes,
        # limit=limit,
        # offset=offset,
        # referrer=referrer,
    )

    return result
