from arroyo.backends.kafka import ConfluentProducer
from confluent_kafka import Producer

from sentry.testutils.helpers.options import override_options
from sentry.utils.confluent_producer import get_confluent_producer


@override_options({"arroyo.producer.confluent-producer-rollout": {"test_producer": True}})
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


@override_options({"arroyo.producer.confluent-producer-rollout": {"test_producer": False}})
def test_get_confluent_producer_not_rolled_out() -> None:
    configuration = {
        "bootstrap.servers": "localhost:9092",
        "client.id": "test_producer",
    }

    producer = get_confluent_producer(configuration)
    assert isinstance(producer, Producer)
    assert not isinstance(producer, ConfluentProducer)


@override_options({"arroyo.producer.confluent-producer-rollout": {}})
def test_get_confluent_producer_no_client_id() -> None:
    configuration = {
        "bootstrap.servers": "localhost:9092",
    }

    producer = get_confluent_producer(configuration)
    assert isinstance(producer, Producer)
    assert not isinstance(producer, ConfluentProducer)
