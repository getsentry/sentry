from enum import Enum


class EventStreamEventType(Enum):
    """
    We have 3 broad categories of event types that we care about in eventstream.
    """

    Error = "error"  # error, default, various security errors
    Transaction = "transaction"  # transactions
    Generic = "generic"  # generic events ingested via the issue platform
