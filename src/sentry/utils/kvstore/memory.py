from collections.abc import MutableMapping
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Generic

from sentry.utils.kvstore.abstract import K, KVStorage, V


@dataclass
class Record(Generic[V]):
    value: V
    expires_at: datetime | None = None


class MemoryKVStorage(KVStorage[K, V]):
    """
    This class provides an in-memory key/value store. It is intended for use
    in testing as a lightweight substitute for other backends.
    """

    def __init__(self) -> None:
        self.__records: MutableMapping[K, Record[V]] = {}

    def get(self, key: K) -> V | None:
        try:
            record = self.__records[key]
        except KeyError:
            return None

        if record.expires_at is not None and datetime.now() > record.expires_at:
            del self.__records[key]
            return None

        return record.value

    def set(self, key: K, value: V, ttl: timedelta | None = None) -> None:
        self.__records[key] = Record(value, datetime.now() + ttl if ttl is not None else None)

    def delete(self, key: K) -> None:
        try:
            del self.__records[key]
        except KeyError:
            pass

    def bootstrap(self, automatic_expiry: bool = True) -> None:
        pass

    def destroy(self) -> None:
        self.__records.clear()
