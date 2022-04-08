# DO NOT CHANGE THESE VALUES
# 1-99
SESSION_METRIC_NAMES = {
    "c:sessions/session@none": 1,
    "s:sessions/error@none": 2,
    "s:sessions/user@none": 3,
    "d:sessions/duration@second": 4,
}
# 100 - 199
TRANSACTION_METRICS_NAMES = {
    "s:transactions/user@none": 100,
    "d:transactions/duration@millisecond": 101,
    "d:transactions/measurements.fcp@millisecond": 102,
    "d:transactions/measurements.lcp@millisecond": 103,
    "d:transactions/measurements.app_start_cold@millisecond": 104,
    "d:transactions/measurements.app_start_warm@millisecond": 105,
    "d:transactions/measurements.cls@millisecond": 106,
    "d:transactions/measurements.fid@millisecond": 107,
    "d:transactions/measurements.fp@millisecond": 108,
    "d:transactions/measurements.frames_frozen@none": 109,
    "d:transactions/measurements.frames_frozen_rate@ratio": 110,
    "d:transactions/measurements.frames_slow@none": 111,
    "d:transactions/measurements.frames_slow_rate@ratio": 112,
    "d:transactions/measurements.frames_total@none": 113,
    "d:transactions/measurements.stall_count@none": 114,
    "d:transactions/measurements.stall_longest_time@millisecond": 115,
    "d:transactions/measurements.stall_percentage@percent": 116,
    "d:transactions/measurements.stall_total_time@millisecond": 117,
    "d:transactions/measurements.ttfb@millisecond": 118,
    "d:transactions/measurements.ttfb.requesttime@millisecond": 119,
    "d:transactions/breakdowns.span_ops.http@millisecond": 120,
    "d:transactions/breakdowns.span_ops.db@millisecond": 121,
    "d:transactions/breakdowns.span_ops.browser@millisecond": 122,
    "d:transactions/breakdowns.span_ops.resource@millisecond": 123,
}

# 200 - 299
SHARED_TAG_STRINGS = {
    "abnormal": 200,
    "crashed": 201,
    "environment": 202,
    "errored": 203,
    "exited": 204,
    "healthy": 205,
    "init": 206,
    "production": 207,
    "release": 208,
    "session.status": 209,
    "staging": 210,
}
SHARED_STRINGS = {**SESSION_METRIC_NAMES, **TRANSACTION_METRICS_NAMES, **SHARED_TAG_STRINGS}
REVERSE_SHARED_STRINGS = {v: k for k, v in SHARED_STRINGS.items()}
