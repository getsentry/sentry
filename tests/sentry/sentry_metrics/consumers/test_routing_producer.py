from datetime import datetime
from typing import MutableSequence, Sequence
from unittest import mock

import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic
from confluent_kafka import Producer

from sentry.sentry_metrics.consumers.indexer.routing_producer import (
    MessageRoute,
    MessageRouter,
    RoutingPayload,
    RoutingProducerStep,
)


class RoundRobinRouter(MessageRouter):
    def __init__(self) -> None:
        self.all_producers: MutableSequence[Producer] = []

        for _ in range(3):
            self.all_producers.append(Producer({"bootstrap.servers": "127.0.0.1:9092"}))

    def get_all_producers(self) -> Sequence[Producer]:
        return self.all_producers

    def get_route_for_message(self, message: Message[RoutingPayload]) -> MessageRoute:
        routing_key = message.payload.routing_header["key"]
        dest_id = routing_key % len(self.all_producers)
        return MessageRoute(self.all_producers[dest_id], Topic(f"result-topic-{dest_id}"))


@pytest.mark.skip("Check whether this test is failing in CI")
def test_routing_producer() -> None:
    """
    Test that the routing producer step correctly routes messages to the desired
    producer and topic. This uses the RoundRobinRouter, which routes messages to
    three different producers and topics
    """
    epoch = datetime(1970, 1, 1)
    orig_topic = Topic("orig-topic")

    commit = mock.Mock()

    router = RoundRobinRouter()
    strategy = RoutingProducerStep(
        commit_function=commit,
        message_router=router,
    )

    for i in range(3):
        value = b'{"something": "something"}'
        data = RoutingPayload(
            routing_header={"key": i}, routing_message=KafkaPayload(None, value, [])
        )
        message = Message(
            BrokerValue(
                data,
                Partition(orig_topic, 0),
                1,
                epoch,
            )
        )

        strategy.submit(message)
        strategy.poll()

    strategy.join()
    assert commit.call_count >= 3
