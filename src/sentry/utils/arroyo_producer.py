from __future__ import annotations

import atexit
from collections import deque
from collections.abc import Callable
from typing import Deque

from arroyo.backends.abstract import ProducerFuture
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_producer_configuration
from arroyo.types import BrokerValue, Partition
from arroyo.types import Topic as ArroyoTopic

from sentry.conf.types.kafka_definition import Topic
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

_ProducerFuture = ProducerFuture[BrokerValue[KafkaPayload]]


class SingletonProducer:
    """
    A Kafka producer that can be instantiated as a global
    variable/singleton/service.

    It is supposed to be used in tasks, where we want to flush the
    producer on process shutdown.
    """

    def __init__(
        self, kafka_producer_factory: Callable[[], KafkaProducer], max_futures: int = 1000
    ) -> None:
        self._producer: KafkaProducer | None = None
        self._factory = kafka_producer_factory
        self._futures: Deque[_ProducerFuture] = deque()
        self.max_futures = max_futures
        self._shutdown_registered = False
        self._is_closed = False

    def produce(
        self, destination: ArroyoTopic | Partition, payload: KafkaPayload
    ) -> _ProducerFuture:
        future = self._get().produce(destination, payload)
        self._track_futures(future)
        return future

    def _get(self) -> KafkaProducer:
        if self._producer is None or self._is_closed:
            # Reinitialize if producer was closed (e.g., by premature atexit handler)
            self._producer = self._factory()
            self._is_closed = False
            
            # Only register atexit handler once
            if not self._shutdown_registered:
                atexit.register(self._shutdown)
                self._shutdown_registered = True

        return self._producer

    def _track_futures(self, future: _ProducerFuture) -> None:
        self._futures.append(future)
        if len(self._futures) >= self.max_futures:
            try:
                future = self._futures.popleft()
            except IndexError:
                return
            else:
                future.result()

    def _shutdown(self) -> None:
        self._is_closed = True
        
        for future in self._futures:
            try:
                future.result()
            except Exception:
                pass

        if self._producer:
            self._producer.close()
            self._producer = None


def get_arroyo_producer(
    name: str,
    topic: Topic,
    additional_config: dict | None = None,
    exclude_config_keys: list[str] | None = None,
    **kafka_producer_kwargs,
) -> KafkaProducer:
    """
    Get an arroyo producer for a given topic.

    Args:
        name: Unique identifier for this producer (used as client.id, for metrics and killswitches)
        topic: The Kafka topic this producer will write to
        additional_config: Additional Kafka configuration to merge with defaults
        exclude_config_keys: List of config keys to exclude from the default configuration
        **kafka_producer_kwargs: Additional keyword arguments passed to KafkaProducer

    Returns:
        KafkaProducer
    """
    topic_definition = get_topic_definition(topic)

    producer_config = get_kafka_producer_cluster_options(topic_definition["cluster"])

    # Remove any excluded config keys
    if exclude_config_keys:
        for key in exclude_config_keys:
            producer_config.pop(key, None)

    # Apply additional config
    if additional_config:
        producer_config.update(additional_config)

    producer_config["client.id"] = name

    return KafkaProducer(
        build_kafka_producer_configuration(default_config=producer_config), **kafka_producer_kwargs
    )
