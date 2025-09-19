from typing import Any

from arroyo.backends.kafka import build_kafka_producer_configuration
from confluent_kafka import Producer


class KafkaPublisher:
    # XXX(markus): Deprecated. Please use `sentry.utils.arroyo_producer.get_arroyo_producer`.
    def __init__(self, connection: dict[str, Any], asynchronous: bool = True) -> None:
        self.producer = Producer(
            build_kafka_producer_configuration(default_config=connection or {})
        )
        self.asynchronous = asynchronous

    def publish(self, channel: str, value: str, key: str | None = None) -> None:
        self.producer.produce(topic=channel, value=value, key=key)
        if self.asynchronous:
            self.producer.poll(0)
        else:
            self.producer.flush()

    def flush(self) -> None:
        """Manually flush the Kafka client buffer."""
        self.producer.flush()
