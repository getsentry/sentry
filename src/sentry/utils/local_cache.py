import hashlib
import threading
from collections import OrderedDict
from collections.abc import Iterator
from typing import Protocol


class Cache[K, V](Protocol):
    def __contains__(self, key: K) -> bool: ...
    def __len__(self) -> int: ...
    def __delitem__(self, key: K) -> None: ...
    def __getitem__(self, key: K) -> V: ...
    def __setitem__(self, key: K, value: V) -> None: ...
    def get(self, key: K) -> V | None: ...
    def pop(self, key: K) -> V | None: ...
    def keys(self) -> Iterator[K]: ...
    def values(self) -> Iterator[V]: ...
    def items(self) -> Iterator[tuple[K, V]]: ...


class LRUCache[K, V]:
    def __init__(self, maxlen: int) -> None:
        self.cache: OrderedDict[K, V] = OrderedDict()
        self.maxlen = maxlen

    def __contains__(self, key: K) -> bool:
        return key in self.cache

    def __len__(self) -> int:
        return len(self.cache)

    def __delitem__(self, key: K) -> None:
        del self.cache[key]

    def __getitem__(self, key: K) -> V:
        self.cache.move_to_end(key)
        return self.cache[key]

    def __setitem__(self, key: K, value: V) -> None:
        self.cache[key] = value
        self.cache.move_to_end(key)
        if len(self.cache) > self.maxlen:
            self.cache.popitem(last=False)

    def get(self, key: K) -> V | None:
        try:
            return self[key]
        except KeyError:
            return None

    def pop(self, key: K) -> V | None:
        return self.cache.pop(key, None)

    def keys(self) -> Iterator[K]:
        yield from self.cache.keys()

    def values(self) -> Iterator[V]:
        yield from self.cache.values()

    def items(self) -> Iterator[tuple[K, V]]:
        yield from self.cache.items()


class ThreadSafeCache[K, V]:
    def __init__(self, cache: Cache[K, V]) -> None:
        self.cache = cache
        self.lock = threading.Lock()

    def __contains__(self, key: K) -> bool:
        with self.lock:
            return key in self.cache

    def __len__(self) -> int:
        with self.lock:
            return len(self.cache)

    def __delitem__(self, key: K) -> None:
        with self.lock:
            del self.cache[key]

    def __getitem__(self, key: K) -> V:
        with self.lock:
            return self.cache[key]

    def __setitem__(self, key: K, value: V) -> None:
        with self.lock:
            self.cache[key] = value

    def get(self, key: K) -> V | None:
        with self.lock:
            return self.cache.get(key)

    def pop(self, key: K) -> V | None:
        with self.lock:
            return self.cache.pop(key)

    def keys(self) -> Iterator[K]:
        with self.lock:
            items = list(self.cache.keys())
        yield from items

    def values(self) -> Iterator[V]:
        with self.lock:
            items = list(self.cache.values())
        yield from items

    def items(self) -> Iterator[tuple[K, V]]:
        with self.lock:
            items = list(self.cache.items())
        yield from items


class SizedKeyCache[V]:
    """
    Keys are hashed to a known size bounding their memory usage. If values are
    also bounded and the cache has a maximum size, maximum memory usage is
    knowable.

    An example use case is debouncing requests over some interval. Given a UNIX
    timestamp as V the total size of the cache is N times 104 bytes.
    """

    def __init__(self, cache: Cache[int, V]):
        self.cache = cache

    def __contains__(self, key: str) -> bool:
        return self._hash_key(key) in self.cache

    def __len__(self) -> int:
        return len(self.cache)

    def __delitem__(self, key: str) -> None:
        del self.cache[self._hash_key(key)]

    def __getitem__(self, key: str) -> V:
        return self.cache[self._hash_key(key)]

    def __setitem__(self, key: str, value: V) -> None:
        self.cache[self._hash_key(key)] = value

    def get(self, key: str) -> V | None:
        return self.cache.get(self._hash_key(key))

    def pop(self, key: str) -> V | None:
        return self.cache.pop(self._hash_key(key))

    def keys(self) -> Iterator[int]:
        yield from self.cache.keys()

    def values(self) -> Iterator[V]:
        yield from self.cache.values()

    def items(self) -> Iterator[tuple[int, V]]:
        yield from self.cache.items()

    def _hash_key(self, key: str) -> int:
        """
        Return the hash of the `key` as an integer.

        Cache keys are strings and unbounded, though its likely some bounds on string length
        exist upstream. Nevertheless strings consume more memory than we should be reasonably
        willing to allocate for some use cases. Hashing the string to a fixed-size integer
        caps memory usage of the keys to a known amount with no loss in lookup capability.

        This method outputs a 40-byte integer.
        """
        digest = hashlib.blake2b(key.encode(), digest_size=15).digest()
        return int.from_bytes(digest, "big")
