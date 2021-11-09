from datetime import datetime
from typing import List, Mapping, Optional, Union

from snuba_sdk.column import Column
from snuba_sdk.conditions import BooleanCondition, Condition
from snuba_sdk.function import CurriedFunction, Function

WhereType = Union[Condition, BooleanCondition]
# TODO: this should be a dataclass instead
ParamsType = Mapping[str, Union[List[int], int, str, datetime]]
SelectType = Union[Column, Function, CurriedFunction]

NormalizedArg = Optional[Union[str, float]]
