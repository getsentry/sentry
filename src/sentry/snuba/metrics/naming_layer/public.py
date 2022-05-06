"""
Module that contains all the public field names queryable from the API. Any time a new Enum is
introduced here, a corresponding MRI needs to be introduced in the corresponding MRI Enum. As an
example,
If we were to introduce a new public sessions field name called "foo.bar", we would add it here
to `SessionMetricKey` as `FOO_BAR="foo.bar"`, then we would need to add an MRI in `SessionMRI`
with the same Enum name but with a value of the MRI so we would add
`FOO_BAR=e:sessions/foo.bar@none`
"""


__all__ = (
    "SessionMetricKey",
    "TransactionMetricKey",
    "TransactionTagsKey",
    "TransactionStatusTagValue",
    "TransactionSatisfactionTagValue",
)

from enum import Enum


class SessionMetricKey(Enum):
    """
    These are the public facing names of the API and only the session fields listed here are
    queryable in the API.
    """

    DURATION = "session.duration"
    ALL = "session.all"
    ABNORMAL = "session.abnormal"
    CRASHED = "session.crashed"
    ERRORED = "session.errored"
    HEALTHY = "session.healthy"
    CRASH_RATE = "session.crash_rate"
    CRASH_FREE_RATE = "session.crash_free_rate"
    ALL_USER = "session.all_user"
    ABNORMAL_USER = "session.abnormal_user"
    CRASHED_USER = "session.crashed_user"
    ERRORED_USER = "session.errored_user"
    HEALTHY_USER = "session.healthy_user"
    CRASH_USER_RATE = "session.crash_user_rate"
    CRASH_FREE_USER_RATE = "session.crash_free_user_rate"


class TransactionMetricKey(Enum):
    """
    These are the public facing names of the API and only the transaction fields listed here are
    queryable in the API.
    """

    USER = "transaction.user"
    DURATION = "transaction.duration"
    MEASUREMENTS_FCP = "transaction.measurements.fcp"
    MEASUREMENTS_LCP = "transaction.measurements.lcp"
    MEASUREMENTS_APP_START_COLD = "transaction.measurements.app_start_cold"
    MEASUREMENTS_APP_START_WARM = "transaction.measurements.app_start_warm"
    MEASUREMENTS_CLS = "transaction.measurements.cls"
    MEASUREMENTS_FID = "transaction.measurements.fid"
    MEASUREMENTS_FP = "transaction.measurements.fp"
    MEASUREMENTS_FRAMES_FROZEN = "transaction.measurements.frames_frozen"
    MEASUREMENTS_FRAMES_FROZEN_RATE = "transaction.measurements.frames_frozen_rate"
    MEASUREMENTS_FRAMES_SLOW = "transaction.measurements.frames_slow"
    MEASUREMENTS_FRAMES_SLOW_RATE = "transaction.measurements.frames_slow_rate"
    MEASUREMENTS_FRAMES_TOTAL = "transaction.measurements.frames_total"
    MEASUREMENTS_STALL_COUNT = "transaction.measurements.stall_count"
    MEASUREMENTS_STALL_LONGEST_TIME = "transaction.measurements.stall_longest_time"
    MEASUREMENTS_STALL_PERCENTAGE = "transaction.measurements.stall_percentage"
    MEASUREMENTS_STALL_TOTAL_TIME = "transaction.measurements.stall_total_time"
    MEASUREMENTS_TTFB = "transaction.measurements.ttfb"
    MEASUREMENTS_TTFB_REQUEST_TIME = "transaction.measurements.ttfb.requesttime"
    BREAKDOWNS_HTTP = "transaction.breakdowns.ops.http"
    BREAKDOWNS_DB = "transaction.breakdowns.ops.db"
    BREAKDOWNS_BROWSER = "transaction.breakdowns.ops.browser"
    BREAKDOWNS_RESOURCE = "transaction.breakdowns.ops.resource"
    FAILURE_RATE = "transaction.failure_rate"
    APDEX = "transaction.apdex"
    MISERABLE_USER = "transaction.miserable_user"
    USER_MISERY = "transaction.user_misery"


# TODO: these tag keys and values below probably don't belong here, and should
# be moved to another more private file.
class TransactionTagsKey(Enum):
    """Identifier for a transaction-related tag."""

    TRANSACTION_STATUS = "transaction.status"
    TRANSACTION_SATISFACTION = "satisfaction"


class TransactionStatusTagValue(Enum):
    """
    Identifier value for a transaction status tag.

    Note that only a subset of values is represented in this enum, not all values.
    """

    OK = "ok"
    CANCELLED = "cancelled"
    UNKNOWN = "unknown"
    ABORTED = "aborted"


class TransactionSatisfactionTagValue(Enum):
    """Identifier value for the satisfaction of a transaction."""

    SATISFIED = "satisfied"
    TOLERATED = "tolerated"
    FRUSTRATED = "frustrated"
