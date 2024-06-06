from __future__ import annotations

import hashlib
from collections.abc import Callable
from copy import deepcopy
from typing import Any, Generic, TypeVar

ValidContextTypes = TypeVar(
    "ValidContextTypes",
    bound=str | int | float | bool | list[str] | list[int] | list[float] | list[bool],
)

EvaluationContextDict = dict[str, ValidContextTypes]


class EvaluationContext:
    """
    Prepared by the application and passed to flagpole to evaluate
    feature conditions.
    """

    def __init__(self, data: EvaluationContextDict):
        self.__data = deepcopy(data)

    def get(self, key: str) -> Any:
        return self.__data.get(key)

    def has(self, key: str) -> Any:
        return key in self.__data

    def size(self) -> int:
        return len(self.__data)

    def id(self) -> int:
        """
        Return a hashed identifier for this context

        The identifier should be stable for a given context contents.
        Identifiers are used to determine rollout groups deterministically
        and consistently.
        """
        keys = self.__data.keys()
        vector = []
        for key in sorted(keys):
            vector.append(key)
            vector.append(str(self.__data[key]))
        hashed = hashlib.sha1(":".join(vector).encode("utf8"))
        return int.from_bytes(hashed.digest(), byteorder="big")


T_CONTEXT_DATA = TypeVar("T_CONTEXT_DATA")


class ContextBuilder(Generic[T_CONTEXT_DATA]):
    """
    Used to build an EvaluationContext instance for use in Flagpole.
    This class aggregates a list of context transformers, each of which are
    responsible for generating a slice of context data.

    This class is meant to be used with Flagpole's `Feature` class:
    >>> from flagpole import ContextBuilder, Feature
    >>> builder = ContextBuilder().add_context_transformer(lambda _dict: dict(foo="bar"))
    >>> feature = Feature.from_feature_dictionary(name="foo", feature_dictionary=dict(), context=builder)
    >>> feature.match(dict())
    """

    context_transformers: list[Callable[[T_CONTEXT_DATA], EvaluationContextDict]]
    exception_handler: Callable[[Exception], Any] | None

    def __init__(self):
        self.context_transformers = []
        self.exception_handler = None

    def add_context_transformer(
        self, context_transformer: Callable[[T_CONTEXT_DATA], EvaluationContextDict]
    ) -> ContextBuilder[T_CONTEXT_DATA]:
        self.context_transformers.append(context_transformer)
        return self

    def add_exception_handler(
        self, exception_handler: Callable[[Exception], None]
    ) -> ContextBuilder[T_CONTEXT_DATA]:
        """
        Add a custom exception handler to the context builder if you need custom handling
        if any of the transformer functions raise an exception. This is useful for swallowing
        or reporting any exceptions that occur while building a context.

        :param exception_handler:
        """
        if self.exception_handler is not None:
            raise Exception("Exception handler is already defined")

        self.exception_handler = exception_handler
        return self

    def build(self, data: T_CONTEXT_DATA | None = None) -> EvaluationContext:
        context_data: EvaluationContextDict = dict()
        if data is None:
            return EvaluationContext(context_data)

        for transformer in self.context_transformers:
            try:
                context_data = {**context_data, **transformer(data)}
            except Exception as e:
                if self.exception_handler is not None:
                    self.exception_handler(e)
                else:
                    raise

        return EvaluationContext(context_data)
