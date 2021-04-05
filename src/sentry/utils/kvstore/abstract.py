from abc import ABC, abstractmethod
from datetime import timedelta
from typing import Generic, Iterator, Optional, Sequence, Tuple, TypeVar

K = TypeVar("K")
V = TypeVar("V")


class KVStorage(ABC, Generic[K, V]):
    """
    This class provides a generic key/value store interface that can be
    implemented using a variety of different storage systems.

    This class is not intended to be used as a proper noun in its own right
    in the system architecture (in other words, this is not intended to be
    "the Sentry key/value store") but should be leveraged as a foundational
    building block in other components that have varying storage needs and
    requirements in depending on the runtime environment.
    """

    @abstractmethod
    def get(self, key: K) -> Optional[V]:
        """
        Fetch a value from the store by its key. Returns the value if it
        exists, otherwise ``None``.
        """
        raise NotImplementedError

    def get_many(self, keys: Sequence[K]) -> Iterator[Tuple[K, V]]:
        """
        Fetch multiple values from the store by their keys. Returns an
        iterator of ``(key, value)`` pairs of items that were present in the
        store (missing items are not returned.)
        """
        # This implementation can/should be overridden by concrete subclasses
        # to improve performance using batched operations where possible.
        for key in keys:
            value = self.get(key)
            if value is not None:
                yield key, value

    @abstractmethod
    def set(self, key: K, value: V, ttl: Optional[timedelta] = None) -> None:
        """
        Set a value in the store by its key, overwriting any data that
        already existed at that key.
        """
        raise NotImplementedError

    @abstractmethod
    def delete(self, key: K) -> None:
        """
        Delete the value at key (if it exists).
        """
        raise NotImplementedError

    def delete_many(self, keys: Sequence[K]) -> None:
        """
        Delete the values at the provided keys (if they exist.)

        This operation is not guaranteed to be atomic and may result in only
        a subset of keys being deleted if an error occurs.
        """
        # This implementation can/should be overridden by concrete subclasses
        # to improve performance using batched operations where possible.
        for key in keys:
            self.delete(key)

    @abstractmethod
    def bootstrap(self) -> None:
        """
        Allocate the resources (create tables, etc.) required by the store to
        be usable.
        """
        raise NotImplementedError

    @abstractmethod
    def destroy(self) -> None:
        """
        Delete all data and release all resources (files, tables, etc.) used
        by the store.
        """
        raise NotImplementedError
