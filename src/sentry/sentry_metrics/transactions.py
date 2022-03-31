"""Base module for transaction-related metrics"""
from enum import Enum


class TransactionMetricsKey(Enum):
    """
    Identifier for a transaction-related metric.

    The values are the metric names sumbitted by Relay.
    """

    TRANSACTION_DURATION = "sentry.transactions.transaction.duration"


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
