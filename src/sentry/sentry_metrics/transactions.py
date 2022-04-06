""" Base module for transactions-related metrics """
from enum import Enum


class TransactionMetricKey(Enum):
    """Identifier for a transaction-related metric

    Values are metric names as submitted by Relay.
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
    BREAKDOWNS_HTTP = "spans.http"
    BREAKDOWNS_DB = "spans.db"
    BREAKDOWNS_BROWSER = "spans.browser"
    BREAKDOWNS_RESOURCE = "spans.resource"
