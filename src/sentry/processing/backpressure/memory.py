from collections.abc import Generator, Mapping
from dataclasses import dataclass
from typing import Any, Union

import rb
import requests
from rediscluster import RedisCluster


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


def query_rabbitmq_memory_usage(host: str) -> ServiceMemory:
    """Returns the currently used memory and the memory limit of a
    RabbitMQ host.
    """

    if not host.endswith("/"):
        host += "/"
    url = f"{host}api/nodes"

    response = requests.get(url, timeout=3)
    response.raise_for_status()
    json = response.json()
    return ServiceMemory(host, json[0]["mem_used"], json[0]["mem_limit"])


# Based on configuration, this could be:
# - a `rediscluster` Cluster (actually `RetryingRedisCluster`)
# - a `rb.Cluster` (client side routing cluster client)
Cluster = Union[RedisCluster, rb.Cluster]


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
        else:
            # rb.Cluster node mapping
            node = cluster.hosts[node_id]
            return NodeInfo(node.host, node.port)
    except Exception:
        return NodeInfo(None, None)


def iter_cluster_memory_usage(cluster: Cluster) -> Generator[ServiceMemory]:
    """
    A generator that yields redis `INFO` results for each of the nodes in the `cluster`.
    """
    if isinstance(cluster, RedisCluster):
        # `RedisCluster` returns these as a dictionary, with the node-id as key
        cluster_info = cluster.info()
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
