from typing import Any

from confluent_kafka import Producer


class KafkaPublisher:
    def __init__(self, connection: dict[str, Any], asynchronous: bool = True) -> None:
        self.producer = Producer(connection or {})
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
