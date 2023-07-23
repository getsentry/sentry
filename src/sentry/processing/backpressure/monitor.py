import logging
import time
from dataclasses import dataclass
from typing import Dict, Generator, List, Mapping, Union

import sentry_sdk
from django.conf import settings

from sentry import options
from sentry.processing.backpressure.health import record_consumer_health

# from sentry import options
from sentry.processing.backpressure.memory import (
    Cluster,
    ServiceMemory,
    iter_cluster_memory_usage,
    query_rabbitmq_memory_usage,
)
from sentry.processing.backpressure.topology import PROCESSING_SERVICES
from sentry.utils import redis

logger = logging.getLogger(__name__)


@dataclass
class Redis:
    cluster: Cluster


@dataclass
class RabbitMq:
    servers: List[str]


Service = Union[Redis, RabbitMq, None]


def check_service_memory(service: Service) -> Generator[ServiceMemory, None, None]:
    """
    This queries the given [`Service`] and returns the [`ServiceMemory`]
    for each of the individual servers that comprise the service.
    """

    if isinstance(service, Redis):
        yield from iter_cluster_memory_usage(service.cluster)

    elif isinstance(service, RabbitMq):
        for server in service.servers:
            yield query_rabbitmq_memory_usage(server)


def load_service_definitions() -> Dict[str, Service]:
    services: Dict[str, Service] = {}
    for name, definition in settings.SENTRY_PROCESSING_SERVICES.items():
        if cluster_id := definition.get("redis"):
            _is_clsuter, cluster, _config = redis.get_dynamic_cluster_from_options(
                setting=f"SENTRY_PROCESSING_SERVICES[{name}]",
                config={"cluster": cluster_id},
            )
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

    for name, service in services.items():
        high_watermark = options.get(f"backpressure.high_watermarks.{name}")
        is_healthy = True

        logger.info("Checking service `%s` (configured high watermark: %s):", name, high_watermark)
        try:
            for memory in check_service_memory(service):
                is_healthy = is_healthy and memory.percentage < high_watermark
                logger.info(
                    "  used: %s, available: %s, percentage: %s",
                    memory.used,
                    memory.available,
                    memory.percentage,
                )
        except Exception as e:
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("service", name)
                sentry_sdk.capture_exception(e)
            is_healthy = False

        service_health[name] = is_healthy
        logger.info("  => healthy: %s", is_healthy)

    return service_health


def start_service_monitoring() -> None:
    services = load_service_definitions()
    assert_all_services_defined(services)

    while True:
        if not options.get("backpressure.monitoring.enabled"):
            time.sleep(options.get("backpressure.monitoring.interval"))
            continue

        with sentry_sdk.start_transaction(name="backpressure.monitoring", sampled=True):
            # first, check each base service and record its health
            service_health = check_service_health(services)

            # then, check the derived services and record their health
            try:
                record_consumer_health(service_health)
            except Exception as e:
                sentry_sdk.capture_exception(e)

        time.sleep(options.get("backpressure.monitoring.interval"))
