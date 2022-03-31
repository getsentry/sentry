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
