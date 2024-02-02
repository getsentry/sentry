from typing import Optional, Sequence, Union

from snuba_sdk import BooleanCondition, Condition, Formula, Timeseries

# Type representing the aggregate value from Snuba, which can be null, int, float or list.
ResultValue = Optional[Union[int, float, list[Optional[Union[int, float]]]]]
# Type representing a series of values with (`time`, `value`) pairs.
Series = list[tuple[str, ResultValue]]
# Type representing a single aggregate value.
Total = ResultValue
# Type representing a single group composed of a key and a value.
Group = tuple[str, str]
# Type representing a hashable group key as a tuple of tuples ((`key_1`, `value_1`), (`key_2, `value_2), ...)
GroupKey = tuple[Group, ...]
# Type representing a sequence of groups [[(`key_1`, `value_1`), (`key_2`, `value_2`), ...], ...]
GroupsCollection = Sequence[Sequence[Group]]
# Type representing the possible expressions for a query.
QueryExpression = Union[Timeseries, Formula]
# Type representing the possible conditions for a query.
QueryCondition = Union[BooleanCondition, Condition]
