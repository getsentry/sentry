from dataclasses import dataclass
from typing import Any, Generator, Mapping, Union

import rb
import requests
from rediscluster import RedisCluster


@dataclass
class ServiceMemory:
    used: int
    available: int
    percentage: float

    def __init__(self, used: int, available: int):
        self.used = used
        self.available = available
        self.percentage = used / available


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
    return ServiceMemory(json[0]["mem_used"], json[0]["mem_limit"])


# Based on configuration, this could be:
# - a `rediscluster` Cluster (actually `RetryingRedisCluster`)
# - a `rb.Cluster` (client side routing cluster client)
# - or any class configured via `client_class`.
Cluster = Union[RedisCluster, rb.Cluster]


def get_memory_usage(info: Mapping[str, Any]) -> ServiceMemory:
    # or alternatively: `used_memory_rss`?
    memory_used = info.get("used_memory", 0)
    # `maxmemory` might be 0 in development
    memory_available = info.get("maxmemory", 0) or info["total_system_memory"]

    return ServiceMemory(memory_used, memory_available)


def iter_cluster_memory_usage(cluster: Cluster) -> Generator[ServiceMemory, None, None]:
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

    for info in cluster_info.values():
        yield get_memory_usage(info)
