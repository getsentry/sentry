from enum import Enum
from typing import Sequence, TypedDict


class GroupState(TypedDict):
    id: int
    is_new: bool
    is_regression: bool
    is_new_group_environment: bool


GroupStates = Sequence[GroupState]


class EventStreamEventType(Enum):
    """
    We have 3 broad categories of event types that we care about in eventstream.
    """

    Error = "error"  # error, default, various security errors
    Transaction = "transaction"  # transactions
    Generic = "generic"  # generic events ingested via the issue platform
