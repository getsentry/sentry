from typing import Tuple

import requests


def query_rabbitmq_memory_usage(host: str) -> Tuple[int, int]:
    """Returns the currently used memory and the memory limit of a
    RabbitMQ host.
    """

    if not host.endswith("/"):
        host += "/"
    url = f"{host}api/nodes"

    response = requests.get(url)
    response.raise_for_status()
    json = response.json()
    return json[0]["mem_used"], json[0]["mem_limit"]
