from __future__ import annotations

import atexit
import os
import time
import traceback
from collections import deque
from collections.abc import Callable

from arroyo.backends.abstract import ProducerFuture
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_producer_configuration
from arroyo.types import BrokerValue, Partition
from arroyo.types import Topic as ArroyoTopic

from sentry.conf.types.kafka_definition import Topic
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

_ProducerFuture = ProducerFuture[BrokerValue[KafkaPayload]]

# DO NOT MERGE: CI-hang repro telemetry, written to files because pytest captures worker stderr
_SP_DEBUG = os.environ.get("SENTRY_SP_DEBUG") == "1"


def _sp_log(msg: str) -> None:
    try:
        with open(f"/tmp/sp-debug-{os.getpid()}.log", "a") as f:
            f.write(f"{time.strftime('%H:%M:%S')} pid={os.getpid()} {msg}\n")
    except OSError:
        pass


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
        self._futures: deque[_ProducerFuture] = deque()
        # DO NOT MERGE: repro override so the pop threshold engages at realistic CI volumes;
        # only applies to default-sized instances so explicit max_futures (incl. unit tests) keep theirs
        env_max = os.environ.get("SENTRY_SP_MAX_FUTURES")
        self.max_futures = int(env_max) if env_max and max_futures == 1000 else max_futures

    def produce(
        self, destination: ArroyoTopic | Partition, payload: KafkaPayload
    ) -> _ProducerFuture:
        future = self._get().produce(destination, payload)
        self._track_futures(future)
        return future

    def _get(self) -> KafkaProducer:
        if self._producer is None:
            self._producer = self._factory()
            if _SP_DEBUG:
                caller = " <- ".join(
                    f"{os.path.basename(f.filename)}:{f.lineno}"
                    for f in traceback.extract_stack()[-7:-2]
                )
                _sp_log(f"producer={id(self):x} CREATED via {caller}")
            atexit.register(self._shutdown)

        return self._producer

    def _track_futures(self, future: _ProducerFuture) -> None:
        self._futures.append(future)
        if _SP_DEBUG and len(self._futures) % 25 == 0:
            _sp_log(f"producer={id(self):x} depth={len(self._futures)} max={self.max_futures}")
        if len(self._futures) >= self.max_futures:
            try:
                future = self._futures.popleft()
            except IndexError:
                return
            else:
                if _SP_DEBUG:
                    start = time.monotonic()
                    try:
                        future.result()
                    except Exception as exc:
                        _sp_log(
                            f"producer={id(self):x} pop BLOCKED {time.monotonic() - start:.1f}s "
                            f"-> raised {type(exc).__name__}"
                        )
                        raise
                    elapsed = time.monotonic() - start
                    if elapsed > 5:
                        _sp_log(f"producer={id(self):x} pop blocked {elapsed:.1f}s (resolved ok)")
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
