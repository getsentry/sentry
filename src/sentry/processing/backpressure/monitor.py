import logging
import time
from collections.abc import Generator, Mapping, MutableMapping
from dataclasses import dataclass
from typing import Union

import sentry_sdk
from django.conf import settings

from sentry import options
from sentry.processing.backpressure.health import UnhealthyReasons, record_consumer_health

# from sentry import options
from sentry.processing.backpressure.memory import (
    Cluster,
    ServiceMemory,
    iter_cluster_memory_usage,
    query_rabbitmq_memory_usage,
)
from sentry.processing.backpressure.topology import ProcessingServices
from sentry.utils import redis

logger = logging.getLogger(__name__)


@dataclass
class Redis:
    cluster: Cluster


@dataclass
class RabbitMq:
    servers: list[str]


Service = Union[Redis, RabbitMq, None]


def check_service_memory(service: Service) -> Generator[ServiceMemory]:
    """
    This queries the given [`Service`] and returns the [`ServiceMemory`]
    for each of the individual servers that comprise the service.
    """

    if isinstance(service, Redis):
        yield from iter_cluster_memory_usage(service.cluster)

    elif isinstance(service, RabbitMq):
        for server in service.servers:
            yield query_rabbitmq_memory_usage(server)


def load_service_definitions() -> dict[str, Service]:
    services: dict[str, Service] = {}
    for name, definition in settings.SENTRY_PROCESSING_SERVICES.items():
        if cluster_id := definition.get("redis"):
            _is_cluster, cluster, _config = redis.get_dynamic_cluster_from_options(
                setting=f"SENTRY_PROCESSING_SERVICES[{name}]",
                config={"cluster": cluster_id},
            )
            services[name] = Redis(cluster)

        elif rabbitmq_urls := definition.get("rabbitmq"):
            services[name] = RabbitMq(rabbitmq_urls)

        else:
            services[name] = None

    return services


def assert_all_services_defined(services: dict[str, Service]) -> None:
    for name in ProcessingServices:
        if name.value not in services:
            raise ValueError(
                f"The `{name.value}` Service is missing from `settings.SENTRY_PROCESSING_SERVICES`."
            )


def check_service_health(services: Mapping[str, Service]) -> MutableMapping[str, UnhealthyReasons]:
    unhealthy_services: MutableMapping[str, UnhealthyReasons] = {}

    for name, service in services.items():
        high_watermark = options.get(f"backpressure.high_watermarks.{name}")
        reasons = []

        logger.info("Checking service `%s` (configured high watermark: %s):", name, high_watermark)
        memory = None
        try:
            for memory in check_service_memory(service):
                if memory.percentage >= high_watermark:
                    reasons.append(memory)
                logger.info("Checking node: %s:%s", memory.host, memory.port)
                logger.info(
                    "  name: %s, used: %s, available: %s, percentage: %s",
                    memory.name,
                    memory.used,
                    memory.available,
                    memory.percentage,
                )
        except Exception as e:
            with sentry_sdk.isolation_scope() as scope:
                scope.set_tag("service", name)
                sentry_sdk.capture_exception(e)
            unhealthy_services[name] = e
            host = memory.host if memory else "unknown"
            port = memory.port if memory else "unknown"
            logger.exception(
                "Error while processing node %s:%s for service %s",
                host,
                port,
                service,
            )
        else:
            unhealthy_services[name] = reasons

        logger.info("  => healthy: %s", not unhealthy_services[name])

    return unhealthy_services


def start_service_monitoring() -> None:
    services = load_service_definitions()
    assert_all_services_defined(services)

    while True:
        if not options.get("backpressure.monitoring.enabled"):
            time.sleep(options.get("backpressure.monitoring.interval"))
            continue

        with sentry_sdk.start_transaction(name="backpressure.monitoring", sampled=True):
            # first, check each base service and record its health
            unhealthy_services = check_service_health(services)

            # then, check the derived services and record their health
            try:
                record_consumer_health(unhealthy_services)
            except Exception as e:
                sentry_sdk.capture_exception(e)

        time.sleep(options.get("backpressure.monitoring.interval"))
