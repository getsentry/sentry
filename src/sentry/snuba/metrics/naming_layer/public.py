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
    "PUBLIC_EXPRESSION_REGEX",
    "PUBLIC_NAME_REGEX",
)

import re
from enum import Enum

from sentry.snuba.metrics.utils import OP_REGEX

PUBLIC_NAME_REGEX = r"([a-z_]+(?:\.[a-z_]+)*)"
PUBLIC_EXPRESSION_REGEX = re.compile(rf"^{OP_REGEX}\({PUBLIC_NAME_REGEX}\)$")


class SessionMetricKey(Enum):
    """
    These are the public facing names of the API and only the session fields listed here are
    queryable in the API.
    """

    DURATION = "session.duration"
    ALL = "session.all"
    ABNORMAL = "session.abnormal"
    CRASHED = "session.crashed"
    CRASH_FREE = "session.crash_free"
    ERRORED = "session.errored"
    ERRORED_PREAGGREGATED = "session.errored_preaggregated"
    HEALTHY = "session.healthy"
    CRASH_RATE = "session.crash_rate"
    CRASH_FREE_RATE = "session.crash_free_rate"
    ALL_USER = "session.all_user"
    ABNORMAL_USER = "session.abnormal_user"
    CRASHED_USER = "session.crashed_user"
    CRASH_FREE_USER = "session.crash_free_user"
    ERRORED_USER = "session.errored_user"
    HEALTHY_USER = "session.healthy_user"
    CRASH_USER_RATE = "session.crash_user_rate"
    CRASH_FREE_USER_RATE = "session.crash_free_user_rate"
    ERRORED_SET = "sessions.errored.unique"
    ANR_RATE = "session.anr_rate"
    FOREGROUND_ANR_RATE = "session.foreground_anr_rate"


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
    MEASUREMENTS_TIME_TO_INITIAL_DISPLAY = "transaction.measurements.time_to_initial_display"
    MEASUREMENTS_TIME_TO_FULL_DISPLAY = "transaction.measurements.time_to_full_display"
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
    FAILURE_COUNT = "transaction.failure_count"
    TEAM_KEY_TRANSACTION = "transactions.team_key_transaction"

    # Span metrics.
    # NOTE: These might be moved to their own namespace soon.
    SPAN_USER = "span.user"
    SPAN_DURATION = "span.duration"


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
