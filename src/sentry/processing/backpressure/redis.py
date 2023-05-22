from typing import Any, Generator, Mapping, Sequence, Union

from redis import Redis
from rediscluster import RedisCluster  # type: ignore

# Based on configuration, this could be:
# - a `rediscluster` Cluster (actually `RetryingRedisCluster`)
# - a straight `Redis` client (actually `FailoverRedis`)
# - or any class configured via `client_class`.
# It could in theory also be a `rb` (aka redis blaster) Cluster, but we
# intentionally do not support these.
Cluster = Union[RedisCluster, Redis]


class RedisMemoryUsageMetrics:
    """
    This class allows querying for the memory usage percentage of a number of
    redis clusters, each consisting of a number of nodes.
    """

    def __init__(self, clusters: Sequence[Cluster]) -> None:
        self.clusters = clusters

    def query_usage_percentage(self) -> float:
        """
        Queries the memory usage (using the `INFO` command) of all the cluster nodes in the
        given clusters, and returns the *highest* usage percentage of any participating node.
        """

        highest_usage = 0.0

        infos = (info for cluster in self.clusters for info in iter_cluster_node_infos(cluster))
        for info in infos:
            # or alternatively: `used_memory_rss`?
            memory_used = info.get("used_memory", 0)
            # `maxmemory` might be 0 in development
            memory_available = info.get("maxmemory", 0) or info.get("total_system_memory", 0)

            if memory_available:
                node_usage = min(memory_used / memory_available, 1.0)
                highest_usage = max(highest_usage, node_usage)

        return highest_usage


def iter_cluster_node_infos(cluster: Cluster) -> Generator[Mapping[str, Any], None, None]:
    """
    A generator that yields redis `INFO` results for each of the nodes in the `cluster`.
    """
    if isinstance(cluster, RedisCluster):
        # `RedisCluster` returns these as a dictionary, with the node-id as key
        yield from cluster.info().values()
    else:
        # otherwise, lets just hope that `info()` does the right thing
        yield cluster.info()
