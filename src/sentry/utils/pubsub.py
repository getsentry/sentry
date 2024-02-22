from confluent_kafka import Producer


class KafkaPublisher:
    def __init__(self, connection, asynchronous: bool = True):
        self.producer = Producer(connection or {})
        self.asynchronous = asynchronous

    def publish(self, channel, value, key=None):
        """Publish a message to Kafka."""
        self.producer.produce(topic=channel, value=value, key=key)
        if self.asynchronous:
            self.poll(0)
        else:
            self.flush()

    def flush(self) -> None:
        """Block and flush messages in the client buffer to Kafka."""
        self.producer.flush()

    def poll(self, timeout: int) -> None:
        """Poll the producer."""
        self.producer.poll(timeout)
