from confluent_kafka import Producer


class KafkaPublisher:
    def __init__(self, connection, asynchronous=True):
        self.producer = Producer(connection or {})
        self.asynchronous = asynchronous

    def flush(self):
        """Manually flush the messages to Kafka.

        Only useful when asynchronous is set to `True`.
        """
        self.producer.flush()

    # CHANGE(cmanallen) - Added `send_async` argument. Publishers are typically initialized as
    # singletons meaning different uses of the singleton in the same memory region may conflict
    # with one another. By passing a stateless argument you can guarantee messages are published
    # asynchronously without considering alternate uses of the producer.
    def publish(self, channel, value, key=None, send_async: bool = False):
        self.producer.produce(topic=channel, value=value, key=key)
        if self.asynchronous or send_async:
            self.producer.poll(0)
        else:
            self.producer.flush()
