from collections.abc import Sequence
from enum import Enum
from typing import Optional, Union

from snuba_sdk import BooleanCondition, Condition, Direction, Formula, Timeseries

from sentry.sentry_metrics.querying.errors import InvalidMetricsQueryError

# Type representing the aggregate value from Snuba, which can be null, int, float or list.
ResultValue = Optional[Union[int, float, list[Optional[Union[int, float]]]]]

# Type representing a series of values with (`time`, `value`) pairs.
Series = list[tuple[str, ResultValue]]

# Type representing a single aggregate value.
Totals = ResultValue

# Type representing a single group composed of a key and a value.
Group = tuple[str, str]

# Type representing a hashable group key as a tuple of tuples ((`key_1`, `value_1`), (`key_2, `value_2), ...)
GroupKey = tuple[Group, ...]

# Type representing a sequence of groups [[(`key_1`, `value_1`), (`key_2`, `value_2`), ...], ...]
GroupsCollection = Sequence[Sequence[Group]]

# Type representing the possible expressions for a query.
QueryExpression = Union[Timeseries, Formula, int, float, str]

# Type representing the possible conditions for a query.
QueryCondition = Union[BooleanCondition, Condition]


class QueryOrder(Enum):
    """
    Represents the order of the query.
    """

    ASC = "asc"
    DESC = "desc"

    @classmethod
    # Used `Union` because `|` conflicts with the parser.
    def from_string(cls, value: str) -> Union["QueryOrder", None]:
        for v in cls:
            if v.value == value:
                return v

        return None

    def to_snuba_order(self) -> Direction:
        if self == QueryOrder.ASC:
            return Direction.ASC
        elif self == QueryOrder.DESC:
            return Direction.DESC

        raise InvalidMetricsQueryError(f"Ordering {self} does not exist is snuba")


class QueryType(Enum):
    """
    Represents the type of query that can be run.

    Due to storage limitations we are not allowing querying series only, but we might work around this limitation in
    case there will be a product need for it.
    """

    TOTALS_AND_SERIES = 0
    TOTALS = 1
