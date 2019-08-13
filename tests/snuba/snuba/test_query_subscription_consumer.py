from __future__ import absolute_import

import json
from copy import deepcopy
from uuid import uuid4

from confluent_kafka import Producer
from django.conf import settings
from django.test.utils import override_settings
from exam import fixture
from mock import call, Mock

from sentry.snuba.models import QuerySubscription
from sentry.snuba.query_subscription_consumer import (
    QuerySubscriptionConsumer,
    register_subscriber,
    subscriber_registry,
)
from sentry.testutils.cases import SnubaTestCase, TestCase


class QuerySubscriptionConsumerTest(TestCase, SnubaTestCase):
    @fixture
    def subscription_id(self):
        return "1234"

    @fixture
    def valid_wrapper(self):
        return {"version": 1, "payload": self.valid_payload}

    @fixture
    def valid_payload(self):
        return {
            "subscription_id": self.subscription_id,
            "values": {"hello": 50},
            "timestamp": 1235,
            "interval": 5,
            "partition": 50,
            "offset": 10,
        }

    @fixture
    def topic(self):
        return uuid4().hex

    @fixture
    def producer(self):
        cluster_name = settings.KAFKA_TOPICS[self.topic]["cluster"]
        conf = {
            "bootstrap.servers": settings.KAFKA_CLUSTERS[cluster_name]["bootstrap.servers"],
            "session.timeout.ms": 6000,
        }
        return Producer(conf)

    def setUp(self):
        super(QuerySubscriptionConsumerTest, self).setUp()
        self.override_settings_cm = override_settings(
            KAFKA_TOPICS={self.topic: {"cluster": "default", "topic": self.topic}}
        )
        self.override_settings_cm.__enter__()
        self.orig_registry = deepcopy(subscriber_registry)

    def tearDown(self):
        super(QuerySubscriptionConsumerTest, self).tearDown()
        self.override_settings_cm.__exit__(None, None, None)
        subscriber_registry.clear()
        subscriber_registry.update(self.orig_registry)

    @fixture
    def registration_key(self):
        return "registered_keyboard_interrupt"

    def test_normal(self):
        cluster_name = settings.KAFKA_TOPICS[self.topic]["cluster"]

        conf = {
            "bootstrap.servers": settings.KAFKA_CLUSTERS[cluster_name]["bootstrap.servers"],
            "session.timeout.ms": 6000,
        }

        producer = Producer(conf)
        producer.produce(self.topic, json.dumps(self.valid_wrapper))
        producer.flush()
        mock_callback = Mock()
        mock_callback.side_effect = KeyboardInterrupt()
        register_subscriber(self.registration_key)(mock_callback)
        sub = QuerySubscription.objects.create(
            project=self.project,
            type=self.registration_key,
            subscription_id=self.subscription_id,
            dataset="something",
            query="hello",
            aggregations=[],
            time_window=1,
            resolution=1,
        )
        consumer = QuerySubscriptionConsumer("hi", topic=self.topic, commit_batch_size=1)
        consumer.run()
        mock_callback.assert_called_once_with(self.valid_payload, sub)

    def test_shutdown(self):
        self.producer.produce(self.topic, json.dumps(self.valid_wrapper))
        valid_wrapper_2 = deepcopy(self.valid_wrapper)
        valid_wrapper_2["payload"]["values"]["hello"] = 25
        self.producer.produce(self.topic, json.dumps(valid_wrapper_2))
        self.producer.flush()

        counts = [0]

        def mock_callback(*args, **kwargs):
            counts[0] += 1
            if counts[0] > 1:
                raise KeyboardInterrupt()

        mock = Mock()
        mock.side_effect = mock_callback

        register_subscriber(self.registration_key)(mock)
        sub = QuerySubscription.objects.create(
            project=self.project,
            type=self.registration_key,
            subscription_id=self.subscription_id,
            dataset="something",
            query="hello",
            aggregations=[],
            time_window=1,
            resolution=1,
        )
        consumer = QuerySubscriptionConsumer("hi", topic=self.topic, commit_batch_size=100)
        consumer.run()
        mock.assert_has_calls(
            [call(self.valid_payload, sub), call(valid_wrapper_2["payload"], sub)]
        )
        # Offset should be committed for the first message, so second run should process
        # the second message again
        valid_wrapper_3 = deepcopy(valid_wrapper_2)
        valid_wrapper_3["payload"]["values"]["hello"] = 5000
        self.producer.produce(self.topic, json.dumps(valid_wrapper_3))
        self.producer.flush()
        mock.reset_mock()
        counts[0] = 0
        consumer.run()
        mock.assert_has_calls(
            [call(valid_wrapper_2["payload"], sub), call(valid_wrapper_3["payload"], sub)]
        )
