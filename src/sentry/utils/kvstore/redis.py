from datetime import timedelta
from typing import Optional

from redis import Redis

from sentry.utils.kvstore.abstract import KVStorage


class RedisKVStorage(KVStorage[str, bytes]):
    def __init__(self, client: Redis) -> None:
        self.__client = client

    def get(self, key: str) -> Optional[bytes]:
        return self.__client.get(key.encode("utf8"))

    def set(self, key: str, value: bytes, ttl: Optional[timedelta] = None) -> None:
        self.__client.set(key.encode("utf8"), value, ex=ttl)

    def delete(self, key: str) -> None:
        self.__client.delete(key.encode("utf8"))

    def bootstrap(self) -> None:
        pass  # nothing to do

    def destroy(self) -> None:
        self.__client.flushdb()
