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
    "SpanMetricKey",
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
    UNHANDLED = "session.unhandled"
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
    UNHANDLED_USER = "session.unhandled_user"
    CRASH_FREE_USER = "session.crash_free_user"
    ERRORED_USER = "session.errored_user"
    HEALTHY_USER = "session.healthy_user"
    CRASH_USER_RATE = "session.crash_user_rate"
    CRASH_FREE_USER_RATE = "session.crash_free_user_rate"
    ERRORED_SET = "sessions.errored.unique"
    ANR_RATE = "session.anr_rate"
    FOREGROUND_ANR_RATE = "session.foreground_anr_rate"
    ABNORMAL_RATE = "session.abnormal_rate"
    ABNORMAL_USER_RATE = "session.abnormal_user_rate"
    ERRORED_RATE = "session.errored_rate"
    ERRORED_USER_RATE = "session.errored_user_rate"
    UNHANDLED_RATE = "session.unhandled_rate"
    UNHANDLED_USER_RATE = "session.unhandled_user_rate"
    UNHEALTHY_RATE = "session.unhealthy_rate"


class SpanMetricKey(Enum):
    USER = "span.user"
    DURATION = "span.duration"
    SELF_TIME = "span.exclusive_time"
    SELF_TIME_LIGHT = "span.exclusive_time_light"
    RESPONSE_CONTENT_LENGTH = "http.response_content_length"
    DECODED_RESPONSE_CONTENT_LENGTH = "http.decoded_response_content_length"
    RESPONSE_TRANSFER_SIZE = "http.response_transfer_size"
    CACHE_ITEM_SIZE = "cache.item_size"

    HTTP_ERROR_COUNT = "span.http_error_count"
    HTTP_ERROR_RATE = "span.http_error_rate"
    HTTP_ERROR_COUNT_LIGHT = "span.http_error_count_light"
    HTTP_ERROR_RATE_LIGHT = "span.http_error_rate_light"

    COUNT_ON_DEMAND = "count.on_demand"
    DIST_ON_DEMAND = "dist.on_demand"
    SET_ON_DEMAND = "set.on_demand"


class SpanTagsKey(Enum):
    HTTP_STATUS_CODE = "span.status_code"


# TODO: these tag keys and values below probably don't belong here, and should
# be moved to another more private file.
class TransactionTagsKey(Enum):
    """Identifier for a transaction-related tag."""

    TRANSACTION_STATUS = "transaction.status"
    TRANSACTION_SATISFACTION = "satisfaction"
    TRANSACTION_HTTP_STATUS_CODE = "http.status_code"


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
