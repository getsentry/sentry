import math
from typing import List, Optional, Tuple

import sentry_sdk
from snuba_sdk import Column, Function

from sentry.api.utils import InvalidParams

MAX_HISTOGRAM_BUCKET = 250

ClickhouseHistogram = List[Tuple[float, float, float]]


def rebucket_histogram(
    data: ClickhouseHistogram,
    histogram_buckets: int = 100,
    histogram_from: Optional[float] = None,
    histogram_to: Optional[float] = None,
) -> ClickhouseHistogram:
    if not data or not histogram_buckets:
        return []
    if histogram_buckets > MAX_HISTOGRAM_BUCKET:
        raise InvalidParams(
            f"We don't have more than {MAX_HISTOGRAM_BUCKET} buckets stored for any "
            f"given metric bucket."
        )

    # Get lower and upper bound of data. If the user defined custom ranges,
    # honor them.
    data.sort()
    min_val = data[0][0]
    max_val = data[-1][1]
    if histogram_from is not None:
        min_val = histogram_from
    if histogram_to is not None:
        max_val = histogram_to

    if min_val > max_val:
        return []

    target_bucket_width = (max_val - min_val) / histogram_buckets

    buckets = [
        (
            min_val + i * target_bucket_width,
            min_val + (i + 1) * target_bucket_width,
        )
        for i in range(histogram_buckets)
    ]

    rv = {bucket: 0.0 for bucket in buckets}

    with sentry_sdk.start_span(
        op="sentry.snuba.metrics.fields.histogram.rebucket_histogram"
    ) as span:
        span.set_data("len_data", len(data))
        span.set_data("len_rv", len(rv))

        # XXX: quadratic function
        assert len(data) < 300
        assert len(rv) < 300
        for lower_source, upper_source, height in data:
            for lower_target, upper_target in rv:
                overlap = min((upper_source, upper_target)) - max((lower_source, lower_target))
                if overlap <= 0:
                    continue

                overlap_perc = overlap / (upper_source - lower_source)
                rv_height = overlap_perc * height
                rv[lower_target, upper_target] += rv_height

    return [(lower, upper, math.ceil(height)) for (lower, upper), height in rv.items()]


def zoom_histogram(
    histogram_buckets: int = 100,
    histogram_from: Optional[float] = None,
    histogram_to: Optional[float] = None,
) -> Optional[Function]:
    # The histogram "zoom" function is only there to limit the number of
    # histogram merge states we have to merge in order to get greater accuracy
    # on lower zoom levels. Since the maximum number of histogram buckets in
    # ClickHouse is a constant number (250), any row we can filter out
    # before aggregation is a potential win in accuracy.
    #
    # We do two things:
    #
    # - We throw away any buckets whose maximum value is lower than
    #   histogram_from, as we know there are no values in those buckets that
    #   overlap with our zoom range.
    # - We throw away any buckets whose minimum value is higher than
    #   histogram_to, for the same reason.
    #
    # Note that we may still end up merging histogram states whose min/max
    # bounds are not strictly within the user-defined bounds
    # histogram_from/histogram_to. It is the job of rebucket_histogram to get
    # rid of those extra datapoints in query results.
    #
    # We use `arrayReduce("maxMerge", [max])` where one would typically write
    # `maxMerge(max)`, or maybe `maxMergeArray([max])` This is because
    # ClickHouse appears to have some sort of internal limitation where nested
    # aggregate functions are disallowed even if they would make sense, at the
    # same time ClickHouse doesn't appear to be clever enough to detect this
    # constellation in all cases. The following ClickHouse SQL is invalid:
    #
    #   select histogramMergeIf(histogram_buckets, maxMerge(max) >= 123)
    #
    # yet somehow this is fine:
    #
    #   select histogramMergeIf(histogram_buckets, arrayReduce('maxMerge', [max]) >= 123)
    #
    # We can't put this sort of filter in the where-clause as the metrics API
    # allows for querying histograms alongside other kinds of data, so almost
    # all user-defined filters end up in a -If aggregate function.
    if histogram_buckets > MAX_HISTOGRAM_BUCKET:
        raise InvalidParams(
            f"We don't have more than {MAX_HISTOGRAM_BUCKET} buckets stored for any "
            f"given metric bucket."
        )

    conditions = []
    if histogram_from is not None:
        conditions.append(
            Function(
                "greaterOrEquals",
                [Function("arrayReduce", ["maxMerge", [Column("max")]]), histogram_from],
            )
        )

    if histogram_to is not None:
        conditions.append(
            Function(
                "lessOrEquals",
                [Function("arrayReduce", ["minMerge", [Column("min")]]), histogram_to],
            )
        )

    if len(conditions) == 1:
        return conditions[0]
    elif conditions:
        return Function("and", conditions)
    else:
        return None
