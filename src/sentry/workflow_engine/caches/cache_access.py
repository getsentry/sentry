from abc import abstractmethod

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

    def set(self, value: T, timeout: float | None) -> None:
        cache.set(self.key(), value, timeout)

    def delete(self) -> bool:
        return cache.delete(self.key())
