# DO NOT CHANGE THESE VALUES
PREFIX = 1 << 63
# 1-99
SESSION_METRIC_NAMES = {
    "c:sessions/session@none": PREFIX + 1,
    "s:sessions/error@none": PREFIX + 2,
    "s:sessions/user@none": PREFIX + 3,
    "d:sessions/duration@second": PREFIX + 4,
}
# 100 - 199
TRANSACTION_METRICS_NAMES = {
    "s:transactions/user@none": PREFIX + 100,
    "d:transactions/duration@millisecond": PREFIX + 101,
    "d:transactions/measurements.fcp@millisecond": PREFIX + 102,
    "d:transactions/measurements.lcp@millisecond": PREFIX + 103,
    "d:transactions/measurements.app_start_cold@millisecond": PREFIX + 104,
    "d:transactions/measurements.app_start_warm@millisecond": PREFIX + 105,
    "d:transactions/measurements.cls@millisecond": PREFIX + 106,
    "d:transactions/measurements.fid@millisecond": PREFIX + 107,
    "d:transactions/measurements.fp@millisecond": PREFIX + 108,
    "d:transactions/measurements.frames_frozen@none": PREFIX + 109,
    "d:transactions/measurements.frames_frozen_rate@ratio": PREFIX + 110,
    "d:transactions/measurements.frames_slow@none": PREFIX + 111,
    "d:transactions/measurements.frames_slow_rate@ratio": PREFIX + 112,
    "d:transactions/measurements.frames_total@none": PREFIX + 113,
    "d:transactions/measurements.stall_count@none": PREFIX + 114,
    "d:transactions/measurements.stall_longest_time@millisecond": PREFIX + 115,
    "d:transactions/measurements.stall_percentage@percent": PREFIX + 116,
    "d:transactions/measurements.stall_total_time@millisecond": PREFIX + 117,
    "d:transactions/measurements.ttfb@millisecond": PREFIX + 118,
    "d:transactions/measurements.ttfb.requesttime@millisecond": PREFIX + 119,
    "d:transactions/breakdowns.span_ops.http@millisecond": PREFIX + 120,
    "d:transactions/breakdowns.span_ops.db@millisecond": PREFIX + 121,
    "d:transactions/breakdowns.span_ops.browser@millisecond": PREFIX + 122,
    "d:transactions/breakdowns.span_ops.resource@millisecond": PREFIX + 123,
}

# 200 - 299
SHARED_TAG_STRINGS = {
    # release helth
    "abnormal": PREFIX + 200,
    "crashed": PREFIX + 201,
    "environment": PREFIX + 202,
    "errored": PREFIX + 203,
    "exited": PREFIX + 204,
    "healthy": PREFIX + 205,
    "init": PREFIX + 206,
    "production": PREFIX + 207,
    "release": PREFIX + 208,
    "session.status": PREFIX + 209,
    "staging": PREFIX + 210,
    "errored_preaggr": PREFIX + 211,
    # transactions
    "transaction": PREFIX + 212,
    "transaction.status": PREFIX + 213,
    "satisfaction": PREFIX + 214,
    "ok": PREFIX + 215,
    "cancelled": PREFIX + 216,
    "unknown": PREFIX + 217,
    "aborted": PREFIX + 218,
    "satisfied": PREFIX + 219,
    "tolerated": PREFIX + 220,
    "frustrated": PREFIX + 221,
    "internal_error": PREFIX + 222,
}
SHARED_STRINGS = {**SESSION_METRIC_NAMES, **TRANSACTION_METRICS_NAMES, **SHARED_TAG_STRINGS}
REVERSE_SHARED_STRINGS = {v: k for k, v in SHARED_STRINGS.items()}
