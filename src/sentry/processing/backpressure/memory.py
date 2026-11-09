from collections.abc import Generator, Mapping
from dataclasses import dataclass
from typing import Any, Union

from redis import StrictRedis
from sentry_redis_tools.clients import RedisCluster


@dataclass
class ServiceMemory:
    name: str
    used: int
    available: int
    percentage: float
    host: str | None = None
    port: int | None = None

    def __init__(self, name: str, used: int, available: int):
        self.name = name
        self.used = used
        self.available = available
        self.percentage = used / available


@dataclass
class NodeInfo:
    host: str | None
    port: int | None


# Based on configuration, this could be:
# - a `rediscluster` Cluster (actually `RetryingRedisCluster`)
# - a `StrictRedis` client for a single host
Cluster = Union[RedisCluster, "StrictRedis[str]", "StrictRedis[bytes]"]


def get_memory_usage(node_id: str, info: Mapping[str, Any]) -> ServiceMemory:
    # or alternatively: `used_memory_rss`?
    memory_used = info.get("used_memory", 0)
    # `maxmemory` might be 0 in development
    memory_available = info.get("maxmemory", 0) or info["total_system_memory"]

    return ServiceMemory(node_id, memory_used, memory_available)


def get_host_port_info(node_id: str, cluster: Cluster) -> NodeInfo:
    """
    Extract the host and port of the redis node in the cluster.
    """
    try:
        if isinstance(cluster, RedisCluster):
            # RedisCluster node mapping
            node = cluster.connection_pool.nodes.nodes.get(node_id)
            return NodeInfo(node["host"], node["port"])
        elif isinstance(cluster, StrictRedis):
            kwargs = cluster.connection_pool.connection_kwargs
            return NodeInfo(kwargs.get("host"), kwargs.get("port"))
    except Exception:
        pass

    return NodeInfo(None, None)


def iter_cluster_memory_usage(cluster: Cluster) -> Generator[ServiceMemory]:
    """
    A generator that yields redis `INFO` results for each of the nodes in the `cluster`.
    """
    if isinstance(cluster, RedisCluster):
        # `RedisCluster` returns these as a dictionary, with the node-id as key
        cluster_info = cluster.info()
    else:
        cluster_info = {"main": cluster.info()}

    for node_id, info in cluster_info.items():
        # we only care about the memory level of leader nodes, not followers
        if info.get("role") != "master":
            continue
        node_info = get_host_port_info(node_id, cluster)
        memory_usage = get_memory_usage(node_id, info)
        memory_usage.host = node_info.host
        memory_usage.port = node_info.port
        yield memory_usage
