from confluent_kafka import Producer


class KafkaPublisher:
    def __init__(self, connection, asynchronous=True):
        self.producer = Producer(connection or {})
        self.asynchronous = asynchronous

    def publish(self, channel, value, key=None):
        self.producer.produce(topic=channel, value=value, key=key)
        if self.asynchronous:
            self.producer.poll(0)
        else:
            self.producer.flush()
