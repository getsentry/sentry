import copy
import sentry_sdk_alpha
from sentry_sdk_alpha._lru_cache import LRUCache
from threading import Lock

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from typing import TypedDict

    FlagData = TypedDict("FlagData", {"flag": str, "result": bool})


DEFAULT_FLAG_CAPACITY = 100


class FlagBuffer:

    def __init__(self, capacity):
        # type: (int) -> None
        self.capacity = capacity
        self.lock = Lock()

        # Buffer is private. The name is mangled to discourage use. If you use this attribute
        # directly you're on your own!
        self.__buffer = LRUCache(capacity)

    def clear(self):
        # type: () -> None
        self.__buffer = LRUCache(self.capacity)

    def __deepcopy__(self, memo):
        # type: (dict[int, Any]) -> FlagBuffer
        with self.lock:
            buffer = FlagBuffer(self.capacity)
            buffer.__buffer = copy.deepcopy(self.__buffer, memo)
            return buffer

    def get(self):
        # type: () -> list[FlagData]
        with self.lock:
            return [
                {"flag": key, "result": value} for key, value in self.__buffer.get_all()
            ]

    def set(self, flag, result):
        # type: (str, bool) -> None
        if isinstance(result, FlagBuffer):
            # If someone were to insert `self` into `self` this would create a circular dependency
            # on the lock. This is of course a deadlock. However, this is far outside the expected
            # usage of this class. We guard against it here for completeness and to document this
            # expected failure mode.
            raise ValueError(
                "FlagBuffer instances can not be inserted into the dictionary."
            )

        with self.lock:
            self.__buffer.set(flag, result)


def add_feature_flag(flag, result):
    # type: (str, bool) -> None
    """
    Records a flag and its value to be sent on subsequent error events.
    We recommend you do this on flag evaluations. Flags are buffered per Sentry scope.
    """
    flags = sentry_sdk_alpha.get_isolation_scope().flags
    flags.set(flag, result)

    span = sentry_sdk_alpha.get_current_span()
    if span:
        span.set_flag(flag, result)
