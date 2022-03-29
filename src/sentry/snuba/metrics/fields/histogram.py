from typing import List, Optional, Tuple

import sentry_sdk

ClickhouseHistogram = List[Tuple[float, float, float]]


def rebucket_histogram(
    data: ClickhouseHistogram,
    histogram_buckets: int,
    histogram_from: Optional[float] = None,
    histogram_to: Optional[float] = None,
) -> ClickhouseHistogram:
    if not data:
        return data

    # Get lower and upper bound of data. If the user defined custom ranges,
    # honor them.
    data.sort()
    min_val = data[0][0]
    max_val = data[-1][1]
    if histogram_from is not None:
        min_val = max(min_val, histogram_from)
    if histogram_to is not None:
        max_val = min(max_val, histogram_to)

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

    return [(lower, upper, height) for (lower, upper), height in rv.items()]
