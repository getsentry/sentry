from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Generic, TypeVar, Union

from snuba_sdk import Formula, Metric, Timeseries

T = TypeVar("T")


class ArgumentType(Generic[T], ABC):
    @abstractmethod
    def validate(self, value: T) -> bool:
        raise NotImplementedError()


# TODO: generalize the `isistance` behavior.
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


@dataclass(frozen=True)
class InheritFilters(Placeholder):
    pass


@dataclass(frozen=True)
class InheritGroupby(Placeholder):
    pass


QueryExpression = Union[Timeseries, Formula]
