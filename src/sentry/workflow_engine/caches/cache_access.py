from abc import abstractmethod
from typing import Self

from sentry.utils.cache import cache


class CacheAccess[T]:
    """
    Base class for type-safe naive cache access.
    """

    @abstractmethod
    def key(self) -> str:
        raise NotImplementedError

    def get(self) -> T | None:
        return cache.get(self.key())

    @classmethod
    def delete_many(cls, accessors: list[Self]) -> None:
        """
        Delete multiple cache values at once.
        """
        if accessors:
            cache.delete_many([accessor.key() for accessor in accessors])

    @classmethod
    def get_many(cls, accessors: list[Self]) -> dict[Self, T | None]:
        """
        Fetch multiple cache values at once.
        """
        if not accessors:
            return {}
        keys = [accessor.key() for accessor in accessors]
        values = cache.get_many(keys)
        return {accessor: values.get(key) for accessor, key in zip(accessors, keys)}

    @classmethod
    def set_many(cls, data: dict[Self, T], timeout: float | None = None) -> list[Self]:
        """
        Set multiple cache values at once.
        """
        if not data:
            return []
        failed_keys = cache.set_many(
            {accessor.key(): value for accessor, value in data.items()}, timeout
        )
        if failed_keys:
            return [accessor for accessor in data.keys() if accessor.key() in failed_keys]
        return []

    def set(self, value: T, timeout: float | None = None) -> None:
        cache.set(self.key(), value, timeout)

    def delete(self) -> bool:
        return cache.delete(self.key())

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, type(self)):
            return False
        return self.key() == other.key()

    def __hash__(self) -> int:
        return hash(self.key())
