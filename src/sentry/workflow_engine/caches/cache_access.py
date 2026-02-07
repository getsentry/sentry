from abc import abstractmethod
from collections.abc import Callable, Mapping, Sequence

from sentry.utils.cache import cache

# Global registry of cache namespaces to detect collisions
_registered_namespaces: set[str] = set()


class CacheAccess[T]:
    """
    Base class for type-safe naive cache access.
    """

    @abstractmethod
    def key(self) -> str:
        raise NotImplementedError

    def get(self) -> T | None:
        return cache.get(self.key())

    def set(self, value: T, timeout: float | None = None) -> None:
        cache.set(self.key(), value, timeout)

    def delete(self) -> bool:
        return cache.delete(self.key())


class _MappingAccessor[K, V](CacheAccess[V]):
    """CacheAccess wrapper for a CacheMapping entry."""

    def __init__(self, mapping: "CacheMapping[K, V]", input: K):
        self._mapping = mapping
        self._input = input

    def key(self) -> str:
        return self._mapping.key(self._input)


class CacheMapping[K, V]:
    """
    Defines a family of cache entries keyed by input type K.
    K is typically int, str, or a NamedTuple thereof.

    Example with namespace (recommended):
        user_cache = CacheMapping[int, UserData](
            lambda uid: str(uid),
            namespace="user",
        )
        # Keys will be "user:{uid}"

    Example without namespace:
        user_cache = CacheMapping[int, UserData](lambda uid: f"user:{uid}")
    """

    def __init__(
        self,
        key_func: Callable[[K], str],
        *,
        namespace: str | None = None,
    ):
        self._key_func = key_func
        self._namespace = namespace
        if namespace is not None:
            if namespace in _registered_namespaces:
                raise ValueError(f"Cache namespace '{namespace}' is already registered")
            _registered_namespaces.add(namespace)

    def key(self, input: K) -> str:
        base_key = self._key_func(input)
        if self._namespace is not None:
            return f"{self._namespace}:{base_key}"
        return base_key

    def get(self, input: K) -> V | None:
        return cache.get(self.key(input))

    def set(self, input: K, value: V, timeout: float | None = None) -> None:
        cache.set(self.key(input), value, timeout)

    def delete(self, input: K) -> bool:
        return cache.delete(self.key(input))

    def get_many(self, inputs: Sequence[K]) -> dict[K, V | None]:
        """
        Fetch multiple cache values at once.

        Returns a dict with an entry for every input key. Missing cache entries
        have a value of None. This guarantees that `get_many([k])[k]` is always
        safe (will not raise KeyError).
        """
        if not inputs:
            return {}
        keys = [self.key(inp) for inp in inputs]
        values = cache.get_many(keys)
        return {inp: values.get(k) for inp, k in zip(inputs, keys)}

    def set_many(self, data: Mapping[K, V], timeout: float | None = None) -> list[K]:
        """
        Set multiple cache values at once.

        Returns a list of input keys that failed to set. An empty list indicates
        all keys were set successfully.
        """
        if not data:
            return []
        key_to_input = {self.key(inp): inp for inp in data}
        failed_keys = cache.set_many(
            {self.key(inp): val for inp, val in data.items()},
            timeout,
        )
        return [key_to_input[k] for k in (failed_keys or [])]

    def delete_many(self, inputs: Sequence[K]) -> None:
        """
        Delete multiple cache values at once.

        This is a best-effort operation; partial failures are not reported.
        """
        if inputs:
            cache.delete_many([self.key(inp) for inp in inputs])

    def accessor(self, input: K) -> CacheAccess[V]:
        return _MappingAccessor(self, input)
