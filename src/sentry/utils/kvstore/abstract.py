from abc import ABC, abstractmethod
from datetime import timedelta
from typing import Generic, Iterator, Optional, Sequence, Tuple, TypeVar


K = TypeVar("K")
V = TypeVar("V")


class KVStorage(ABC, Generic[K, V]):
    @abstractmethod
    def get(self, key: K) -> Optional[V]:
        raise NotImplementedError

    def get_many(self, keys: Sequence[K]) -> Iterator[Tuple[K, V]]:
        for key in keys:
            value = self.get(key)
            if value is not None:
                yield key, value

    @abstractmethod
    def set(self, key: K, value: V, ttl: Optional[timedelta] = None) -> None:
        raise NotImplementedError

    @abstractmethod
    def delete(self, key: K) -> None:
        raise NotImplementedError

    def delete_many(self, keys: Sequence[K]) -> None:
        for key in keys:
            self.delete(key)

    @abstractmethod
    def bootstrap(self) -> None:
        raise NotImplementedError
