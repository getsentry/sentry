"""Base module for transaction-related metrics"""
from enum import Enum


class TransactionMetricKey(Enum):
    """
    Identifier for a transaction-related metric.

    The values are the metric names sumbitted by Relay.
    """

    USER = "sentry.transactions.user"
    DURATION = "sentry.transactions.transaction.duration"
    MEASUREMENTS_FCP = "sentry.transactions.measurements.fcp"
    MEASUREMENTS_LCP = "sentry.transactions.measurements.lcp"
    MEASUREMENTS_APP_START_COLD = "sentry.transactions.measurements.app_start_cold"
    MEASUREMENTS_APP_START_WARM = "sentry.transactions.measurements.app_start_warm"
    MEASUREMENTS_CLS = "sentry.transactions.measurements.cls"
    MEASUREMENTS_FID = "sentry.transactions.measurements.fid"
    MEASUREMENTS_FP = "sentry.transactions.measurements.fp"
    MEASUREMENTS_FRAMES_FROZEN = "sentry.transactions.measurements.frames_frozen"
    MEASUREMENTS_FRAMES_FROZEN_RATE = "sentry.transactions.measurements.frames_frozen_rate"
    MEASUREMENTS_FRAMES_SLOW = "sentry.transactions.measurements.frames_slow"
    MEASUREMENTS_FRAMES_SLOW_RATE = "sentry.transactions.measurements.frames_slow_rate"
    MEASUREMENTS_FRAMES_TOTAL = "sentry.transactions.measurements.frames_total"
    MEASUREMENTS_STALL_COUNT = "sentry.transactions.measurements.stall_count"
    MEASUREMENTS_STALL_LONGEST_TIME = "sentry.transactions.measurements.stall_longest_time"
    MEASUREMENTS_STALL_PERCENTAGE = "sentry.transactions.measurements.stall_percentage"
    MEASUREMENTS_STALL_TOTAL_TIME = "sentry.transactions.measurements.stall_total_time"
    MEASUREMENTS_TTFB = "sentry.transactions.measurements.ttfb"
    MEASUREMENTS_TTFB_REQUEST_TIME = "sentry.transactions.measurements.ttfb.requesttime"
    BREAKDOWNS_HTTP = "sentry.transactions.breakdowns.span_ops.http"
    BREAKDOWNS_DB = "sentry.transactions.breakdowns.span_ops.db"
    BREAKDOWNS_BROWSER = "sentry.transactions.breakdowns.span_ops.browser"
    BREAKDOWNS_RESOURCE = "sentry.transactions.breakdowns.span_ops.resource"


class TransactionTagsKey(Enum):
    """Identifier for a transaction-related tag."""

    TRANSACTION_STATUS = "transaction.status"


class TransactionStatusTagValue(Enum):
    """
    Identifier value for a transaction status tag.

    Note that only a subset of values is represented in this enum, not all values.
    """

    OK = "ok"
    CANCELLED = "cancelled"
    UNKNOWN = "unknown"
    ABORTED = "aborted"
