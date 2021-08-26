from datetime import timedelta
from typing import Optional

from redis import Redis

from sentry.utils.kvstore.abstract import KVStorage


class RedisKVStorage(KVStorage[str, bytes]):
    """
    This class provides a key/value store backed by Redis (either a single node
    or cluster.)
    """

    def __init__(self, client: "Redis[bytes]") -> None:
        self.client = client

    def get(self, key: str) -> Optional[bytes]:
        return self.client.get(key.encode("utf8"))

    def set(self, key: str, value: bytes, ttl: Optional[timedelta] = None) -> None:
        self.client.set(key.encode("utf8"), value, ex=ttl)

    def delete(self, key: str) -> None:
        self.client.delete(key.encode("utf8"))

    def bootstrap(self) -> None:
        pass  # nothing to do

    def destroy(self) -> None:
        self.client.flushdb()
