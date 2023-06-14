from typing import Any, Generator, Mapping, Tuple, Union

from redis import Redis
from rediscluster import RedisCluster

# Based on configuration, this could be:
# - a `rediscluster` Cluster (actually `RetryingRedisCluster`)
# - a straight `Redis` client (actually `FailoverRedis`)
# - or any class configured via `client_class`.
# It could in theory also be a `rb` (aka redis blaster) Cluster, but we
# intentionally do not support these.
Cluster = Union[RedisCluster, Redis]


def get_memory_usage(info: Mapping[str, Any]) -> Tuple[int, int]:
    # or alternatively: `used_memory_rss`?
    memory_used = info.get("used_memory", 0)
    # `maxmemory` might be 0 in development
    memory_available = info.get("maxmemory", 0) or info.get("total_system_memory", 0)

    return (memory_used, memory_available)


def iter_cluster_memory_usage(cluster: Cluster) -> Generator[Tuple[int, int], None, None]:
    """
    A generator that yields redis `INFO` results for each of the nodes in the `cluster`.
    """
    if isinstance(cluster, RedisCluster):
        # `RedisCluster` returns these as a dictionary, with the node-id as key
        for info in cluster.info().values():
            yield get_memory_usage(info)
    else:
        # otherwise, lets just hope that `info()` does the right thing
        yield get_memory_usage(cluster.info())
