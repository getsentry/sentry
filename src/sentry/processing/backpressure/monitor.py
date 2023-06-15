import time
from dataclasses import dataclass
from typing import Dict, Generator, List, Mapping, Union

from django.conf import settings

from sentry import options
from sentry.processing.backpressure.health import record_consumer_health
from sentry.processing.backpressure.rabbitmq import query_rabbitmq_memory_usage

# from sentry import options
from sentry.processing.backpressure.redis import Cluster, iter_cluster_memory_usage
from sentry.processing.backpressure.topology import PROCESSING_SERVICES
from sentry.utils import redis


@dataclass
class Redis:
    cluster: Cluster


@dataclass
class RabbitMq:
    servers: List[str]


Service = Union[Redis, RabbitMq, None]


@dataclass
class ServiceMemory:
    used: int
    available: int
    percentage: float

    def __init__(self, used: int, available: int):
        self.used = used
        self.available = max(available, 1)
        self.percentage = min(used / available, 1.0)


def check_service_memory(service: Service) -> Generator[ServiceMemory, None, None]:
    """
    This queries the given [`Service`] and returns the [`ServiceMemory`]
    for each of the individual servers that comprise the service.
    """

    if isinstance(service, Redis):
        for used, available in iter_cluster_memory_usage(service.cluster):
            yield ServiceMemory(used, available)

    elif isinstance(service, RabbitMq):
        for server in service.servers:
            used, available = query_rabbitmq_memory_usage(server)
            yield ServiceMemory(used, available)


def load_service_definitions() -> Dict[str, Service]:
    services: Dict[str, Service] = {}
    for name, definition in settings.SENTRY_PROCESSING_SERVICES.items():
        if cluster_id := definition.get("redis"):
            cluster = redis.redis_clusters.get(cluster_id)
            services[name] = Redis(cluster)

        elif rabbitmq_urls := definition.get("rabbitmq"):
            services[name] = RabbitMq(rabbitmq_urls)

        else:
            services[name] = None

    return services


def assert_all_services_defined(services: Dict[str, Service]) -> None:
    for name in PROCESSING_SERVICES:
        if name not in services:
            raise ValueError(
                f"The `{name}` Service is missing from `settings.SENTRY_PROCESSING_SERVICES`."
            )


def check_service_health(services: Mapping[str, Service]) -> Mapping[str, bool]:
    service_health = {}
    high_watermarks = options.get("backpressure.high_watermarks")

    for name, service in services.items():
        high_watermark = high_watermarks[name]
        is_healthy = True
        for memory in check_service_memory(service):
            is_healthy = memory.percentage < high_watermark

        service_health[name] = is_healthy

    return service_health


def start_service_monitoring() -> None:
    services = load_service_definitions()
    assert_all_services_defined(services)

    while True:
        if not options.get("backpressure.monitoring.enabled"):
            time.sleep(options.get("backpressure.monitoring.interval"))
            continue

        # first, check each base service and record its health
        service_health = check_service_health(services)

        # then, check the derived services and record their health
        record_consumer_health(service_health)

        time.sleep(options.get("backpressure.monitoring.interval"))
