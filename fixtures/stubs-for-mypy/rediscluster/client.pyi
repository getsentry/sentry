from typing import TypeVar

from redis import Redis

T = TypeVar("T", str, bytes)

class RedisCluster(Redis[T]):
    ...
