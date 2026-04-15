import threading
from typing import Any

from arroyo.backends.kafka import build_kafka_producer_configuration

from sentry.utils.confluent_producer import get_confluent_producer


class KafkaPublisher:
    # XXX(markus): Deprecated. Please use `sentry.utils.arroyo_producer.get_arroyo_producer`.
    def __init__(self, connection: dict[str, Any], asynchronous: bool = True) -> None:
        connection = connection or {}
        if "client.id" not in connection:
            connection["client.id"] = "sentry.utils.pubsub"
        self.producer = get_confluent_producer(
            build_kafka_producer_configuration(default_config=connection)
        )
        self.asynchronous = asynchronous
        self._poll_thread = threading.Thread(
            target=self.__worker,
            name="KafkaPublisher.poll",
            daemon=True,
        )
        self._poll_thread.start()

    def __worker(self) -> None:
        """
        Drain rdkafka's internal queue continuously so stats ops (generated
        by statistics.interval.ms=1000 that arroyo sets on all producers)
        don't accumulate when the publisher is idle between publish() calls.
        Without this, each stats op holds a JSON blob that is never freed,
        causing RSS growth and OOMKill when no attachments for a long period.

        Similar to https://github.com/getsentry/arroyo/blob/a4bd9a7ef5e9a23a7862e278d9881d0a7a7e18e5/arroyo/backends/kafka/consumer.py#L774-L784
        """
        while True:
            self.producer.poll(0.1)

    def publish(self, channel: str, value: str, key: str | None = None) -> None:
        self.producer.produce(topic=channel, value=value, key=key)
        if self.asynchronous:
            self.producer.poll(0)
        else:
            self.producer.flush()

    def flush(self) -> None:
        """Manually flush the Kafka client buffer."""
        self.producer.flush()
