from __future__ import annotations

import atexit
from collections import deque
from collections.abc import Callable
from typing import Deque

from arroyo.backends.abstract import ProducerFuture
from arroyo.backends.kafka import KafkaPayload, KafkaProducer
from arroyo.types import BrokerValue, Partition, Topic

_ProducerFuture = ProducerFuture[BrokerValue[KafkaPayload]]


class SingletonProducer:
    """
    A Kafka producer that can be instantiated as a global
    variable/singleton/service.

    It is supposed to be used in Celery tasks, where we want to flush the
    producer on process shutdown.
    """

    def __init__(
        self, kafka_producer_factory: Callable[[], KafkaProducer], max_futures: int = 1000
    ) -> None:
        self._producer: KafkaProducer | None = None
        self._factory = kafka_producer_factory
        self._futures: Deque[_ProducerFuture] = deque()
        self.max_futures = max_futures

    def produce(self, destination: Topic | Partition, payload: KafkaPayload) -> _ProducerFuture:
        future = self._get().produce(destination, payload)
        self._track_futures(future)
        return future

    def _get(self) -> KafkaProducer:
        if self._producer is None:
            self._producer = self._factory()
            atexit.register(self._shutdown)

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
        for future in self._futures:
            try:
                future.result()
            except Exception:
                pass

        if self._producer:
            self._producer.close()
