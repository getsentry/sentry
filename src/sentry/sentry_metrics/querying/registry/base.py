from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Generic, TypeVar

from snuba_sdk import Metric

from sentry.sentry_metrics.querying.errors import InvalidMetricsQueryError
from sentry.sentry_metrics.querying.types import QueryExpression

T = TypeVar("T")


class ArgumentType(Generic[T], ABC):
    @abstractmethod
    def validate(self, value: T) -> bool:
        raise NotImplementedError()


class NumberArg(ArgumentType[int]):
    def validate(self, value: T) -> bool:
        return isinstance(value, int) or isinstance(value, float)


class StringArg(ArgumentType[str]):
    def validate(self, value: T) -> bool:
        return isinstance(value, str)


class QueryExpressionArg(ArgumentType[QueryExpression]):
    def validate(self, value: T) -> bool:
        return isinstance(value, QueryExpression.__args__)


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
class InheritGroupBys(Placeholder):
    pass


class RegistryEntry(ABC):
    """
    Entry of the registry which maps an operation to an expression.
    """

    @abstractmethod
    def op(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def expression(self) -> QueryExpression:
        raise NotImplementedError


class ExpressionRegistry:
    """
    Registry for derived metric expressions.
    Every derived metric has a unique MRI that can be referenced in queries. It
    stands for a query expression that is expanded during query execution.
    """

    def __init__(self):
        self._metrics: dict[str, RegistryEntry] = {}

    def register(self, register_entry: RegistryEntry):
        """
        Register a public name for translation to an MRI.
        """
        self._metrics[register_entry.op()] = register_entry

    def resolve(self, op: str) -> RegistryEntry:
        registry_entry = self.try_resolve(op)
        if registry_entry is None:
            raise InvalidMetricsQueryError(f"No entry found for operation {op}")

        return registry_entry

    def try_resolve(self, op: str) -> RegistryEntry | None:
        return self._metrics.get(op)


_REGISTRY: ExpressionRegistry = ExpressionRegistry()


def default_expression_registry() -> ExpressionRegistry:
    """
    Returns the default expression registry.
    """
    return _REGISTRY


def register_derived_metric(registry_entry: RegistryEntry):
    """
    Register a derived metric that will be expanded in queries.
    The expression can be an MQL string, in which case it will be parsed
    on-the-fly. This can raise ``InvalidMetricsQuery`` if it is malformed.
    Use ``expand_derived_metrics`` to expand derived metrics in a query. This is
    done automatically by ``get_series``.
    """
    _REGISTRY.register(registry_entry)
