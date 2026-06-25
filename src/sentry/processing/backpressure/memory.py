from collections.abc import Generator, Mapping
from dataclasses import dataclass
from typing import Any, Union

import rb
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
# - a `redis` RedisCluster (actually `RetryingRedisCluster`)
# - a `rb.Cluster` (client side routing cluster client)
Cluster = Union[RedisCluster, rb.Cluster, StrictRedis]


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
            # redis-py keys cluster results by node name ("host:port"); resolve
            # it back to the node to read its host/port.
            node = cluster.get_node(node_name=node_id)
            if node is not None:
                return NodeInfo(node.host, node.port)
        elif isinstance(cluster, rb.Cluster):
            # rb.Cluster node mapping
            node = cluster.hosts[node_id]
            return NodeInfo(node.host, node.port)
    except Exception:
        pass

    return NodeInfo(None, None)


def iter_cluster_memory_usage(cluster: Cluster) -> Generator[ServiceMemory]:
    """
    A generator that yields redis `INFO` results for each of the nodes in the `cluster`.
    """
    if isinstance(cluster, RedisCluster):
        # redis-py routes INFO to a single default node unless we explicitly
        # target the primaries; the result is then a dict keyed by node name
        # ("host:port").
        cluster_info = cluster.info(target_nodes=RedisCluster.PRIMARIES)
    elif isinstance(cluster, StrictRedis):
        cluster_info = {"main": cluster.info()}
    else:
        # rb.Cluster returns a promise with a dictionary with a _local_ node-id as key
        with cluster.all() as client:
            promise = client.info()
        cluster_info = promise.value

    for node_id, info in cluster_info.items():
        # we only care about the memory level of leader nodes, not followers
        if info.get("role") != "master":
            continue
        node_info = get_host_port_info(node_id, cluster)
        memory_usage = get_memory_usage(node_id, info)
        memory_usage.host = node_info.host
        memory_usage.port = node_info.port
        yield memory_usage
