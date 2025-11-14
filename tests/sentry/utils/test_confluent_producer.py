from typing import int
from arroyo.backends.kafka import ConfluentProducer
from confluent_kafka import Producer

from sentry.utils.confluent_producer import get_confluent_producer


def test_get_confluent_producer() -> None:
    configuration = {
        "bootstrap.servers": "localhost:9092",
        "client.id": "test_producer",
    }

    producer = get_confluent_producer(configuration)
    assert producer is not None

    assert isinstance(producer, Producer)
    assert isinstance(producer, ConfluentProducer)

    for attrs in Producer.__dict__.keys():
        assert hasattr(producer, attrs)
