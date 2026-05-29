import hashlib
from collections import OrderedDict
from threading import Lock


class BoundedLRUCache[K, V]:
    def __init__(self, maxlen: int) -> None:
        self.cache: OrderedDict[K, V] = OrderedDict()
        self.lock = Lock()
        self.maxlen = maxlen

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
            self.cache.move_to_end(key)
            return self.cache[key]

    def __setitem__(self, key: K, value: V) -> None:
        with self.lock:
            self.cache[key] = value
            self.cache.move_to_end(key)
            if len(self.cache) > self.maxlen:
                self.cache.popitem(last=False)


class DebouncedDedeuplicatedCache:
    """
    Specialized cache for deduplicating operations which also have timed refresh
    intervals.

    This cache's size is bounded to ~100-bytes per entry. Multiplying `max_size`
    by 100 gives the maximum memory consumption of the class.
    """

    def __init__(self, max_size: int):
        self.cache: BoundedLRUCache[int, int] = BoundedLRUCache(max_size)

    def __contains__(self, key: str) -> bool:
        return self._hash_key(key) in self.cache

    def __len__(self) -> int:
        return len(self.cache)

    def __delitem__(self, key: str) -> None:
        del self.cache[self._hash_key(key)]

    def __getitem__(self, key: str) -> int | None:
        return self.cache[self._hash_key(key)]

    def __setitem__(self, key: str, timestamp: int) -> None:
        self.cache[self._hash_key(key)] = timestamp

    def get(self, key: str) -> int | None:
        try:
            return self[key]
        except KeyError:
            return None

    def _hash_key(self, key: str) -> int:
        """
        Return the hash of the `key` as an integer.

        Cache keys are strings and unbounded, though its likely some bounds on string length
        exist upstream. Nevertheless strings consume more memory than we should be reasonably
        willing to a debounce cache.

        This method outputs a 40-byte integer.
        """
        digest = hashlib.blake2b(key.encode(), digest_size=15).digest()
        return int.from_bytes(digest, "big")
