from datetime import timedelta
from typing import Optional, TypeVar, Union

from redis import Redis

from sentry.utils.kvstore.abstract import KVStorage

# The value type of the Redis client depends on the value of the
# ``decode_responses`` parameter passed to the client constructor:
# https://github.com/python/typeshed/blob/f0bf6ee/stubs/redis/redis/client.pyi#L62-L63
V = TypeVar("V", bound=Union[str, bytes])


class RedisKVStorage(KVStorage[str, V]):
    """
    This class provides a key/value store backed by Redis (either a single node
    or cluster.)
    """

    def __init__(self, client: "Redis[V]") -> None:
        self.client = client

    def get(self, key: str) -> Optional[V]:
        return self.client.get(key.encode("utf8"))

    def set(self, key: str, value: V, ttl: Optional[timedelta] = None) -> None:
        self.client.set(key.encode("utf8"), value, ex=ttl)

    def delete(self, key: str) -> None:
        self.client.delete(key.encode("utf8"))

    def bootstrap(self) -> None:
        pass  # nothing to do

    def destroy(self) -> None:
        self.client.flushdb()
