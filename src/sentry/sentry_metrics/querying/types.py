from typing import List, Optional, Sequence, Tuple, Union

from snuba_sdk import Formula, Timeseries

# Type representing the aggregate value from Snuba, which can be null, int, float or list.
ResultValue = Optional[Union[int, float, List[Optional[Union[int, float]]]]]
# Type representing a series of values with (`time`, `value`) pairs.
Series = List[Tuple[str, ResultValue]]
# Type representing a single aggregate value.
Total = ResultValue
# Type representing a single group composed of a key and a value.
Group = Tuple[str, str]
# Type representing a hashable group key as a tuple of tuples ((`key_1`, `value_1`), (`key_2, `value_2), ...)
GroupKey = Tuple[Group, ...]
# Type representing a sequence of groups [[(`key_1`, `value_1`), (`key_2`, `value_2`), ...], ...]
GroupsCollection = Sequence[Sequence[Group]]
# Type representing the possible expressions for a query.
QueryExpression = Union[Timeseries, Formula]
