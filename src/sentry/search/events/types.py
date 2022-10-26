from collections import namedtuple
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Mapping, Optional, Union

from snuba_sdk.aliased_expression import AliasedExpression
from snuba_sdk.column import Column
from snuba_sdk.conditions import BooleanCondition, Condition
from snuba_sdk.entity import Entity
from snuba_sdk.function import CurriedFunction, Function
from snuba_sdk.orderby import OrderBy
from typing_extensions import TypedDict

WhereType = Union[Condition, BooleanCondition]
# TODO: this should be a dataclass instead
ParamsType = Mapping[str, Union[List[int], int, str, datetime]]
SelectType = Union[AliasedExpression, Column, Function, CurriedFunction]

NormalizedArg = Optional[Union[str, float]]
HistogramParams = namedtuple(
    "HistogramParams", ["num_buckets", "bucket_size", "start_offset", "multiplier"]
)


@dataclass
class QueryFramework:
    orderby: List[OrderBy]
    having: List[WhereType]
    functions: List[CurriedFunction]
    entity: Entity


class EventsMeta(TypedDict):
    fields: Dict[str, str]
    tips: Dict[str, str]


class EventsResponse(TypedDict):
    data: List[Dict[str, Any]]
    meta: EventsMeta
