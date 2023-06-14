from dataclasses import dataclass
from typing import Dict, List, Tuple
from urllib.parse import urlparse

import requests


@dataclass
class RabbitMqHost:
    hostname: str
    port: int
    vhost: str
    username: str
    password: str


def parse_rabbitmq(url: str) -> RabbitMqHost:
    parsed = urlparse(url)
    hostname, port = parsed.hostname, parsed.port
    username, password = parsed.username, parsed.password
    vhost = parsed.path[1::]  # skip leading `/`
    if port is None:
        port = 15672

    if hostname is None:
        raise ValueError("missing hostname")

    if username is None:
        raise ValueError("missing username")

    if password is None:
        raise ValueError("missing password")

    if vhost is None:
        raise ValueError("missing vhost")

    return RabbitMqHost(hostname, port, vhost, username, password)


def query_rabbitmq_memory_usage(host: RabbitMqHost) -> Tuple[int, int]:
    # TODO: actually get the memory usage :-)
    return (0, 1)


def get_queue_sizes(hosts: List[RabbitMqHost], queues: List[str]) -> Dict[str, int]:
    new_sizes = {queue: 0 for queue in queues}

    for host in hosts:
        url = f"http://{host.hostname}:{host.port}/api/queues/{host.vhost}"
        response = requests.get(url, auth=(host.username, host.password))
        response.raise_for_status()

        for queue in response.json():
            name = queue["name"]
            size = queue["messages"]
            if name in queues:
                new_sizes[name] = max(new_sizes[name], size)

    return new_sizes
