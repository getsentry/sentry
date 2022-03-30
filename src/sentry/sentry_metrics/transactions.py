"""Base module for transaction-related metrics"""
from enum import Enum


class TransactionMetricsKey(Enum):
    """
    Identifier for a transaction-related metric.

    The values are the metric names sumbitted by Relay.
    """

    TRANSACTION = "transaction"
    TRANSACTION_STATUS = "transaction.status"
