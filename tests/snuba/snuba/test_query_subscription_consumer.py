from __future__ import absolute_import

import json
from copy import deepcopy
from uuid import uuid4

import pytz
from confluent_kafka import Producer
from dateutil.parser import parse as parse_date
from django.conf import settings
from django.test.utils import override_settings
from exam import fixture
from sentry.utils.compat.mock import call, Mock

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
            "values": {"data": [{"hello": 50}]},
            "timestamp": "2020-01-01T01:23:45.1234",
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
            aggregation=0,
            time_window=1,
            resolution=1,
        )
        consumer = QuerySubscriptionConsumer("hi", topic=self.topic, commit_batch_size=1)
        consumer.run()

        payload = self.valid_payload
        payload["timestamp"] = parse_date(payload["timestamp"]).replace(tzinfo=pytz.utc)
        mock_callback.assert_called_once_with(payload, sub)

    def test_shutdown(self):
        self.producer.produce(self.topic, json.dumps(self.valid_wrapper))
        valid_wrapper_2 = deepcopy(self.valid_wrapper)
        valid_wrapper_2["payload"]["values"]["hello"] = 25
        valid_wrapper_3 = deepcopy(valid_wrapper_2)
        valid_wrapper_3["payload"]["values"]["hello"] = 5000
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
            aggregation=0,
            time_window=1,
            resolution=1,
        )
        consumer = QuerySubscriptionConsumer("hi", topic=self.topic, commit_batch_size=100)
        consumer.run()
        valid_payload = self.valid_payload
        valid_payload["timestamp"] = parse_date(valid_payload["timestamp"]).replace(tzinfo=pytz.utc)
        valid_wrapper_2["payload"]["timestamp"] = parse_date(
            valid_wrapper_2["payload"]["timestamp"]
        ).replace(tzinfo=pytz.utc)
        mock.assert_has_calls([call(valid_payload, sub), call(valid_wrapper_2["payload"], sub)])
        # Offset should be committed for the first message, so second run should process
        # the second message again
        self.producer.produce(self.topic, json.dumps(valid_wrapper_3))
        self.producer.flush()
        mock.reset_mock()
        counts[0] = 0
        consumer.run()
        valid_wrapper_3["payload"]["timestamp"] = parse_date(
            valid_wrapper_3["payload"]["timestamp"]
        ).replace(tzinfo=pytz.utc)

        mock.assert_has_calls(
            [call(valid_wrapper_2["payload"], sub), call(valid_wrapper_3["payload"], sub)]
        )
