__all__ = ("SessionMRI", "TransactionMRI")

from enum import Enum


class SessionMRI(Enum):
    # Ingested
    SESSION = "c:sessions/session@none"
    ERROR = "s:sessions/error@none"
    USER = "s:sessions/user@none"
    RAW_DURATION = "d:sessions/duration@s"

    # Derived
    ALL = "e:sessions/all@none"
    HEALTHY = "e:sessions/healthy@none"
    ERRORED = "e:sessions/errored@none"
    ERRORED_PREAGGREGATED = "e:sessions/error.preaggr@none"
    ERRORED_SET = "e:sessions/error.unique@none"
    CRASHED = "e:sessions/crashed@none"
    ABNORMAL = "e:sessions/abnormal@none"
    CRASH_FREE_RATE = "e:sessions/crash_free_rate@pct"
    ALL_USER = "e:sessions/user.all@none"
    HEALTHY_USER = "e:sessions/user.healthy@none"
    ERRORED_USER = "e:sessions/user.errored@none"
    ERRORED_USER_ALL = "e:sessions/user.all_errored@none"
    CRASHED_AND_ABNORMAL_USER = "e:sessions/user.crashed_abnormal@none"
    CRASHED_USER = "e:sessions/user.crashed@none"
    ABNORMAL_USER = "e:sessions/user.abnormal@none"
    CRASH_FREE_USER_RATE = "e:sessions/user.crash_free_rate@pct"
    DURATION = "d:sessions/duration.exited@s"


class TransactionMRI(Enum):
    # Ingested
    USER = "s:transactions/user@none"
    DURATION = "d:transactions/duration@ms"
    MEASUREMENTS_FCP = "d:transactions/measurements.fcp@ms"
    MEASUREMENTS_LCP = "d:transactions/measurements.lcp@ms"
    MEASUREMENTS_APP_START_COLD = "d:transactions/measurements.app_start_cold@ms"
    MEASUREMENTS_APP_START_WARM = "d:transactions/measurements.app_start_warm@ms"
    MEASUREMENTS_CLS = "d:transactions/measurements.cls@ms"
    MEASUREMENTS_FID = "d:transactions/measurements.fid@ms"
    MEASUREMENTS_FP = "d:transactions/measurements.fp@ms"
    MEASUREMENTS_FRAMES_FROZEN = "d:transactions/measurements.frames_frozen"
    MEASUREMENTS_FRAMES_FROZEN_RATE = "d:transactions/measurements.frames_frozen_rate"
    MEASUREMENTS_FRAMES_SLOW = "d:transactions/measurements.frames_slow"
    MEASUREMENTS_FRAMES_SLOW_RATE = "d:transactions/measurements.frames_slow_rate"
    MEASUREMENTS_FRAMES_TOTAL = "d:transactions/measurements.frames_total"
    MEASUREMENTS_STALL_COUNT = "d:transactions/measurements.stall_count"
    MEASUREMENTS_STALL_LONGEST_TIME = "d:transactions/measurements.stall_longest_time"
    MEASUREMENTS_STALL_PERCENTAGE = "d:transactions/measurements.stall_percentage"
    MEASUREMENTS_STALL_TOTAL_TIME = "d:transactions/measurements.stall_total_time"
    MEASUREMENTS_TTFB = "d:transactions/measurements.ttfb"
    MEASUREMENTS_TTFB_REQUEST_TIME = "d:transactions/measurements.ttfb.requesttime"
    BREAKDOWNS_HTTP = "d:transactions/breakdowns.span_ops.http"
    BREAKDOWNS_DB = "d:transactions/breakdowns.span_ops.db"
    BREAKDOWNS_BROWSER = "d:transactions/breakdowns.span_ops.browser"
    BREAKDOWNS_RESOURCE = "d:transactions/breakdowns.span_ops.resource"

    # Derived
    ALL = "e:transactions/all@none"
    FAILURE_COUNT = "e:transactions/failure_count@none"
    FAILURE_RATE = "e:transaction/failure_rate@pct"
