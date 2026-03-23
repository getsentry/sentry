from collections.abc import Callable, Collection, Mapping

from sentry.utils.cache import cache

# Global registry of cache namespaces to detect collisions
_registered_namespaces: set[str] = set()


class CacheMapping[K, V]:
    """
    Defines a family of cache entries keyed by input type K.
    K is typically int, str, or a NamedTuple thereof.

    CacheMappings should be defined at module level and evaluated at import time.
    Namespace collisions are detected at registration time to catch configuration
    errors early.

    Example with namespace (recommended):
        # At module level:
        _user_cache = CacheMapping[int, UserData](
            lambda uid: str(uid),
            namespace="user",
        )
        # Keys will be "user:{uid}"

    Example without namespace:
        _user_cache = CacheMapping[int, UserData](lambda uid: f"user:{uid}")
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

    def get_many(self, inputs: Collection[K]) -> dict[K, V | None]:
        """
        Fetch multiple cache values at once.

        Returns a dict with an entry for every input key. Missing cache entries
        have a value of None. This guarantees that `get_many([k])[k]` is always
        safe (will not raise KeyError).
        """
        if not inputs:
            return {}
        key_to_input = {self.key(inp): inp for inp in inputs}
        values = cache.get_many(key_to_input.keys())
        return {key_to_input[k]: values.get(k) for k in key_to_input}

    def set_many(self, data: Mapping[K, V], timeout: float | None = None) -> list[K]:
        """
        Set multiple cache values at once.

        Returns a list of input keys that failed to set. An empty list indicates
        all keys were set successfully.
        """
        if not data:
            return []
        keyed_data = {self.key(inp): (inp, val) for inp, val in data.items()}
        failed_keys = cache.set_many(
            {k: val for k, (_, val) in keyed_data.items()},
            timeout,
        )
        failed = set(failed_keys or [])
        return [inp for k, (inp, _) in keyed_data.items() if k in failed]

    def delete_many(self, inputs: Collection[K]) -> None:
        """
        Delete multiple cache values at once.

        This is a best-effort operation; partial failures are not reported.
        """
        if inputs:
            cache.delete_many([self.key(inp) for inp in inputs])


def test_only_clear_registered_namespaces() -> None:
    _registered_namespaces.clear()
