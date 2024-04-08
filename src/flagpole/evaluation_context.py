import hashlib
from collections.abc import Mapping
from typing import Any


class EvaluationContext:
    """
    Prepared by the application and passed to flagpole to evaluate
    feature conditions.
    """

    def __init__(self, data: Mapping[str, Any]):
        self.__data = data

    def get(self, key: str) -> Any:
        return self.__data.get(key)

    def has(self, key: str) -> Any:
        return key in self.__data

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
