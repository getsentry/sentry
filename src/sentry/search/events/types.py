from datetime import datetime
from typing import List, Mapping, Union

from snuba_sdk.column import Column
from snuba_sdk.conditions import BooleanCondition, Condition
from snuba_sdk.function import CurriedFunction, Function

WhereType = Union[Condition, BooleanCondition]
# TODO: this should be a TypedDict instead
ParamsType = Mapping[str, Union[List[int], int, str, datetime]]
# Function is a subclass of CurriedFunction
AggregateType = Union[CurriedFunction]
SelectType = Union[Column, Function, CurriedFunction]
