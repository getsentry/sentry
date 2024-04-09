from __future__ import annotations

import hashlib
from collections.abc import Callable, Mapping
from copy import deepcopy
from typing import Any


class EvaluationContext:
    """
    Prepared by the application and passed to flagpole to evaluate
    feature conditions.
    """

    def __init__(self, data: Mapping[str, Any]):
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


# A function that mutates the given evaluation context
EvaluationContextTransformer = Callable[[dict[str, Any]], dict[str, Any]]


class ContextBuilder:
    context_transformers: list[EvaluationContextTransformer] = []

    def add_context_transformer(
        self, context_transformer: EvaluationContextTransformer
    ) -> ContextBuilder:
        self.context_transformers.append(context_transformer)
        return self

    def build(self, data: dict[str, Any] | None = None) -> EvaluationContext:
        builder_data: dict[str, Any] = data or dict()
        context_data: dict[str, Any] = dict()

        for transformer in self.context_transformers:
            context_data = {**context_data, **transformer(builder_data)}

        return EvaluationContext(context_data)
