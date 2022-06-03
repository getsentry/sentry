"""
This module introduces a single unique identifier (similar to a Uniform Resource Identifier, URI),
called the Metric Resource Identifier (MRI) for each metric name extracted from sessions and
transactions.

MRIs have the format <type>:<ns>/<name>@<unit>, comprising the following components:
  - Type: counter (c), set (s), distribution (d), gauge (g), and evaluated (e) for derived numeric
metrics.
  - Namespace: Identifying the product entity and use case affiliation of the metric.
  - Name: The display name of the metric in the allowed character set.
  - Unit: The verbatim unit name.
Any Enum defined here but does not have a corresponding Enum name in `public.py` is considered
and treated as an internal implementation detail which is not queryable by the API.
As an example, `SessionMRI.ERRORED_PREAGGREGATED` has no corresponding enum in `SessionMetricKey`
and so it is a private metric, whereas `SessionMRI.CRASH_FREE_RATE` has a corresponding enum in
`SessionMetricKey` with the same name i.e. `SessionMetricKey.CRASH_FREE_RATE` and hence is a public
metric that is queryable by the API.
"""
__all__ = ("SessionMRI", "TransactionMRI")

import re
from enum import Enum

MRI_NAME_REGEX = re.compile(r"^(\w+)\(([\w.:/@]+)\)$")


class SessionMRI(Enum):
    # Ingested
    SESSION = "c:sessions/session@none"
    ERROR = "s:sessions/error@none"
    USER = "s:sessions/user@none"
    RAW_DURATION = "d:sessions/duration@second"

    # Derived
    ALL = "e:sessions/all@none"
    HEALTHY = "e:sessions/healthy@none"
    ERRORED = "e:sessions/errored@none"
    ERRORED_PREAGGREGATED = "e:sessions/error.preaggr@none"
    ERRORED_SET = "e:sessions/error.unique@none"
    ERRORED_ALL = "e:sessions/all_errored@none"
    CRASHED_AND_ABNORMAL = "e:sessions/crashed_abnormal@none"
    CRASHED = "e:sessions/crashed@none"
    ABNORMAL = "e:sessions/abnormal@none"
    CRASH_RATE = "e:sessions/crash_rate@ratio"
    CRASH_FREE_RATE = "e:sessions/crash_free_rate@ratio"
    ALL_USER = "e:sessions/user.all@none"
    HEALTHY_USER = "e:sessions/user.healthy@none"
    ERRORED_USER = "e:sessions/user.errored@none"
    ERRORED_USER_ALL = "e:sessions/user.all_errored@none"
    CRASHED_AND_ABNORMAL_USER = "e:sessions/user.crashed_abnormal@none"
    CRASHED_USER = "e:sessions/user.crashed@none"
    ABNORMAL_USER = "e:sessions/user.abnormal@none"
    CRASH_USER_RATE = "e:sessions/user.crash_rate@ratio"
    CRASH_FREE_USER_RATE = "e:sessions/user.crash_free_rate@ratio"
    DURATION = "d:sessions/duration.exited@second"


class TransactionMRI(Enum):
    # Ingested
    USER = "s:transactions/user@none"
    DURATION = "d:transactions/duration@millisecond"
    MEASUREMENTS_FCP = "d:transactions/measurements.fcp@millisecond"
    MEASUREMENTS_LCP = "d:transactions/measurements.lcp@millisecond"
    MEASUREMENTS_APP_START_COLD = "d:transactions/measurements.app_start_cold@millisecond"
    MEASUREMENTS_APP_START_WARM = "d:transactions/measurements.app_start_warm@millisecond"
    MEASUREMENTS_CLS = "d:transactions/measurements.cls@millisecond"
    MEASUREMENTS_FID = "d:transactions/measurements.fid@millisecond"
    MEASUREMENTS_FP = "d:transactions/measurements.fp@millisecond"
    MEASUREMENTS_FRAMES_FROZEN = "d:transactions/measurements.frames_frozen@none"
    MEASUREMENTS_FRAMES_FROZEN_RATE = "d:transactions/measurements.frames_frozen_rate@ratio"
    MEASUREMENTS_FRAMES_SLOW = "d:transactions/measurements.frames_slow@none"
    MEASUREMENTS_FRAMES_SLOW_RATE = "d:transactions/measurements.frames_slow_rate@ratio"
    MEASUREMENTS_FRAMES_TOTAL = "d:transactions/measurements.frames_total@none"
    MEASUREMENTS_STALL_COUNT = "d:transactions/measurements.stall_count@none"
    MEASUREMENTS_STALL_LONGEST_TIME = "d:transactions/measurements.stall_longest_time@millisecond"
    MEASUREMENTS_STALL_PERCENTAGE = "d:transactions/measurements.stall_percentage@percent"
    MEASUREMENTS_STALL_TOTAL_TIME = "d:transactions/measurements.stall_total_time@millisecond"
    MEASUREMENTS_TTFB = "d:transactions/measurements.ttfb@millisecond"
    MEASUREMENTS_TTFB_REQUEST_TIME = "d:transactions/measurements.ttfb.requesttime@millisecond"
    BREAKDOWNS_HTTP = "d:transactions/breakdowns.span_ops.http@millisecond"
    BREAKDOWNS_DB = "d:transactions/breakdowns.span_ops.db@millisecond"
    BREAKDOWNS_BROWSER = "d:transactions/breakdowns.span_ops.browser@millisecond"
    BREAKDOWNS_RESOURCE = "d:transactions/breakdowns.span_ops.resource@millisecond"

    # Derived
    ALL = "e:transactions/all@none"
    FAILURE_COUNT = "e:transactions/failure_count@none"
    FAILURE_RATE = "e:transaction/failure_rate@ratio"
    SATISFIED = "e:transactions/satisfied@none"
    TOLERATED = "e:transactions/tolerated@none"
    APDEX = "e:transactions/apdex@ratio"
    MISERABLE_USER = "e:transactions/user.miserable@none"
    ALL_USER = "e:transactions/user.all@none"
    USER_MISERY = "e:transactions/user_misery@ratio"
