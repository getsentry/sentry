from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Generic, List, Optional, Sequence, Tuple, TypeVar, Union

from snuba_sdk import Formula, Metric, Timeseries

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

T = TypeVar("T")


class ArgumentType(Generic[T], ABC):
    @abstractmethod
    def validate(self, value: T) -> bool:
        raise NotImplementedError()


class IntArg(ArgumentType[int]):
    def validate(self, value: T) -> bool:
        return isinstance(value, int)


class StringArg(ArgumentType[str]):
    def validate(self, value: T) -> bool:
        return isinstance(value, str)


class MetricArg(ArgumentType[Metric]):
    def validate(self, value: T) -> bool:
        return isinstance(value, Metric)


@dataclass(frozen=True)
class Placeholder:
    pass


@dataclass(frozen=True)
class Argument(Generic[T], Placeholder):
    position: int
    type: ArgumentType[T]

    def validate(self, value: T) -> bool:
        return self.type.validate(value)
