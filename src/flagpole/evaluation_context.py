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

    __data: EvaluationContextDict
    __identity_fields: set[str]
    __id: int

    def __init__(self, data: EvaluationContextDict, identity_fields: set[str] | None = None):
        self.__data = deepcopy(data)
        self.__set_identity_fields(identity_fields)
        self.__id = self.__generate_id()

    def __set_identity_fields(self, identity_fields: set[str] | None = None):
        trimmed_id_fields = set()
        if identity_fields is not None:
            for field in identity_fields:
                if field in self.__data:
                    trimmed_id_fields.add(field)

        if not trimmed_id_fields:
            trimmed_id_fields.update(self.__data.keys())

        self.__identity_fields = trimmed_id_fields

    def __generate_id(self) -> int:
        """
        Generates and return a hashed identifier for this context

        The identifier should be stable for a given context contents.
        Identifiers are used to determine rollout groups deterministically
        and consistently.
        """
        keys = list(self.__identity_fields)
        vector = []
        for key in sorted(keys):
            vector.append(key)
            vector.append(str(self.__data[key]))
        hashed = hashlib.sha1(":".join(vector).encode("utf8"))
        return int.from_bytes(hashed.digest(), byteorder="big")

    @property
    def id(self) -> int:
        """
        Guard against context mutation by using this virtual property as a
        getter for the private ID field.
        """
        return self.__id

    def get(self, key: str) -> Any:
        return self.__data.get(key)

    def has(self, key: str) -> Any:
        return key in self.__data

    def size(self) -> int:
        return len(self.__data)

    def to_dict(self) -> EvaluationContextDict:
        return deepcopy(self.__data)

    def __repr__(self) -> str:
        return f"<flagpole.evaluation_context.EvaluationContext data={self.__data!r}>"


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
    >>> feature.match(EvaluationContext(dict()))
    """

    context_transformers: list[Callable[[T_CONTEXT_DATA], EvaluationContextDict]]
    exception_handler: Callable[[Exception], Any] | None
    __identity_fields: set[str]

    def __init__(self):
        self.context_transformers = []
        self.exception_handler = None
        self.__identity_fields = set()

    def add_context_transformer(
        self,
        context_transformer: Callable[[T_CONTEXT_DATA], EvaluationContextDict],
        identity_fields: list[str] | None = None,
    ) -> ContextBuilder[T_CONTEXT_DATA]:
        self.context_transformers.append(context_transformer)
        if identity_fields is not None:
            self.__identity_fields.update(identity_fields)

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

        return EvaluationContext(context_data, self.__identity_fields)
