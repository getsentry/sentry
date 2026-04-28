import time
from collections import OrderedDict
from collections.abc import Callable
from threading import Lock
from typing import Protocol, TypeVar

T = TypeVar("T")
U = TypeVar("U")


class CacheProtocol[T, U](Protocol):
    def __contains__(self, key: T) -> bool: ...

    def __delitem__(self, key: T) -> None: ...

    def __len__(self) -> int: ...

    def __getitem__(self, key: T) -> U: ...

    def __setitem__(self, key: T, value: U) -> None: ...


class BoundedFifoCache(CacheProtocol[T, U]):
    """
    Thread-safe bounded FIFO cache implementation.
    """

    def __init__(self, maxlen: int) -> None:
        self.cache: OrderedDict[T, U] = OrderedDict()
        self.lock = Lock()
        self.maxlen = maxlen

    def __contains__(self, key: T) -> bool:
        with self.lock:
            return key in self.cache

    def __len__(self) -> int:
        with self.lock:
            return len(self.cache)

    def __delitem__(self, key: T) -> None:
        with self.lock:
            del self.cache[key]

    def __getitem__(self, key: T) -> U:
        with self.lock:
            return self.cache[key]

    def __setitem__(self, key: T, value: U) -> None:
        with self.lock:
            self.cache[key] = value
            if len(self.cache) > self.maxlen:
                self.cache.popitem(last=False)


class BoundedLRUCache(BoundedFifoCache[T, U]):
    """
    Thread-safe bounded least-recently-used cache implementation.
    """

    def __getitem__(self, key: T) -> U:
        with self.lock:
            self.cache.move_to_end(key)
            return self.cache[key]


class TimeLimitedCache(CacheProtocol[T, U]):
    """
    Time limited cache implementation. Not thread-safe.
    """

    def __init__(
        self,
        cache: CacheProtocol[T, tuple[int, U]],
        maxage: int = 60,
    ) -> None:
        self.cache = cache
        self.lock = Lock()
        self.maxage = maxage

    def __contains__(self, key: T) -> bool:
        try:
            self[key]
        except KeyError:
            return False
        else:
            return True

    def __len__(self):
        return len(self.cache)

    def __delitem__(self, key: T) -> None:
        del self.cache[key]

    def __setitem__(self, key: T, value: U) -> None:
        self.cache[key] = (int(time.time()), value)

    def __getitem__(self, key: T) -> U:
        cached_at, value = self.cache[key]
        if (cached_at + self.maxage) <= int(time.time()):
            del self[key]
            raise KeyError(key)
        return value


class AutoCache(CacheProtocol[T, U]):
    """
    Auto cache implementation. Caches the result of a function call on read.

    If the intent is to use this cache in a threaded environment you will need to ensure the cache
    passed to the init method is thread-safe. This cache does not guarantee thread-safety on its
    own.
    """

    def __init__(self, fn: Callable[[T], U], cache: CacheProtocol[T, U]) -> None:
        self.cache = cache
        self.fn = fn

    def __contains__(self, key: T) -> bool:
        return key in self.cache

    def __len__(self):
        return len(self.cache)

    def __delitem__(self, key: T) -> None:
        del self.cache[key]

    def __setitem__(self, key: T, value: U) -> None:
        self.cache[key] = value

    def __getitem__(self, key: T) -> U:
        try:
            return self.cache[key]
        except KeyError:
            value = self.fn(key)
            self[key] = value
            return value
