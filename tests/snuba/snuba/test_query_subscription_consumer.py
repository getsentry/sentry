import time
from copy import deepcopy
from datetime import timedelta
from functools import cached_property
from unittest import mock
from unittest.mock import Mock, call
from uuid import uuid4

import pytz
from confluent_kafka import Producer
from confluent_kafka.admin import AdminClient
from dateutil.parser import parse as parse_date
from django.conf import settings
from django.test.utils import override_settings

from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery
from sentry.snuba.query_subscription_consumer import (
    QuerySubscriptionConsumer,
    register_subscriber,
    subscriber_registry,
    topic_to_dataset,
)
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.utils import json, kafka_config
from sentry.utils.batching_kafka_consumer import create_topics


class QuerySubscriptionConsumerTest(TestCase, SnubaTestCase):
    @cached_property
    def subscription_id(self):
        return "1234"

    @cached_property
    def old_valid_wrapper(self):
        return {"version": 2, "payload": self.old_payload}

    @cached_property
    def old_payload(self):
        return {
            "subscription_id": self.subscription_id,
            "result": {"data": [{"hello": 50}]},
            "request": {"some": "data"},
            "timestamp": "2020-01-01T01:23:45.1234",
        }

    @cached_property
    def valid_wrapper(self):
        return {"version": 3, "payload": self.valid_payload}

    @cached_property
    def valid_payload(self):
        return {
            "subscription_id": "1234",
            "result": {"data": [{"hello": 50}]},
            "request": {
                "some": "data",
                "query": """MATCH (metrics_counters) SELECT sum(value) AS value BY
                        tags[3] WHERE org_id = 1 AND project_id IN tuple(1) AND metric_id = 16
                        AND tags[3] IN tuple(13, 4)""",
            },
            "entity": "metrics_counters",
            "timestamp": "2020-01-01T01:23:45.1234",
        }

    @cached_property
    def topic(self):
        return uuid4().hex

    def setUp(self):
        super().setUp()
        self.override_settings_cm = override_settings(
            KAFKA_TOPICS={self.topic: {"cluster": "default"}}
        )
        self.override_settings_cm.__enter__()
        self.orig_registry = deepcopy(subscriber_registry)

        cluster_options = kafka_config.get_kafka_admin_cluster_options(
            "default", {"allow.auto.create.topics": "true"}
        )
        self.admin_client = AdminClient(cluster_options)

        self.kafka_cluster = settings.KAFKA_TOPICS[self.topic]["cluster"]
        create_topics(self.kafka_cluster, [self.topic])

    def tearDown(self):
        super().tearDown()
        self.override_settings_cm.__exit__(None, None, None)
        subscriber_registry.clear()
        subscriber_registry.update(self.orig_registry)
        self.admin_client.delete_topics([self.topic])

    @cached_property
    def producer(self):
        conf = {
            "bootstrap.servers": settings.KAFKA_CLUSTERS[self.kafka_cluster]["common"][
                "bootstrap.servers"
            ],
            "session.timeout.ms": 6000,
        }
        return Producer(conf)

    @cached_property
    def registration_key(self):
        return "registered_keyboard_interrupt"

    def create_subscription(self):
        with self.tasks():
            snuba_query = create_snuba_query(
                SnubaQuery.Type.ERROR,
                Dataset.Events,
                "hello",
                "count()",
                timedelta(minutes=1),
                timedelta(minutes=1),
                None,
            )
            sub = create_snuba_subscription(self.project, self.registration_key, snuba_query)
            sub.subscription_id = self.subscription_id
            sub.status = 0
            sub.save()
        return sub

    def test_old(self):
        cluster_name = settings.KAFKA_TOPICS[self.topic]["cluster"]

        conf = {
            "bootstrap.servers": settings.KAFKA_CLUSTERS[cluster_name]["common"][
                "bootstrap.servers"
            ],
            "session.timeout.ms": 6000,
        }

        producer = Producer(conf)
        producer.produce(self.topic, json.dumps(self.old_valid_wrapper))
        producer.flush()
        with mock.patch.dict(topic_to_dataset, {self.topic: Dataset.Metrics}):
            consumer = QuerySubscriptionConsumer("hi", topic=self.topic, commit_batch_size=1)
        mock_callback = Mock(side_effect=lambda *a, **k: consumer.signal_shutdown())
        register_subscriber(self.registration_key)(mock_callback)
        sub = self.create_subscription()
        consumer.run()

        payload = self.old_payload
        payload["values"] = payload["result"]
        payload["timestamp"] = parse_date(payload["timestamp"]).replace(tzinfo=pytz.utc)
        mock_callback.assert_called_once_with(payload, sub)

    def test_normal(self):
        cluster_name = settings.KAFKA_TOPICS[self.topic]["cluster"]

        conf = {
            "bootstrap.servers": settings.KAFKA_CLUSTERS[cluster_name]["common"][
                "bootstrap.servers"
            ],
            "session.timeout.ms": 6000,
        }

        producer = Producer(conf)
        producer.produce(self.topic, json.dumps(self.valid_wrapper))
        producer.flush()
        with mock.patch.dict(topic_to_dataset, {self.topic: Dataset.Metrics}):
            consumer = QuerySubscriptionConsumer("hi", topic=self.topic, commit_batch_size=1)
        mock_callback = Mock(side_effect=lambda *a, **k: consumer.signal_shutdown())
        register_subscriber(self.registration_key)(mock_callback)
        sub = self.create_subscription()
        consumer.run()

        payload = self.valid_payload
        payload["values"] = payload["result"]
        payload["timestamp"] = parse_date(payload["timestamp"]).replace(tzinfo=pytz.utc)
        mock_callback.assert_called_once_with(payload, sub)

    def test_shutdown(self):
        valid_wrapper_2 = deepcopy(self.valid_wrapper)
        valid_wrapper_2["payload"]["result"]["data"][0]["hello"] = 25

        valid_wrapper_3 = deepcopy(self.valid_wrapper)
        valid_wrapper_3["payload"]["result"]["data"][0]["hello"] = 5000

        self.producer.produce(self.topic, json.dumps(self.valid_wrapper))
        self.producer.produce(self.topic, json.dumps(valid_wrapper_2))
        self.producer.produce(self.topic, json.dumps(valid_wrapper_3))
        self.producer.flush()

        def normalize_payload(payload):
            return {
                **payload,
                "values": payload["result"],
                "timestamp": parse_date(payload["timestamp"]).replace(tzinfo=pytz.utc),
            }

        with mock.patch.dict(topic_to_dataset, {self.topic: Dataset.Events}):
            consumer = QuerySubscriptionConsumer("hi", topic=self.topic, commit_batch_size=100)

        def mock_callback(*args, **kwargs):
            if mock.call_count >= len(expected_calls):
                consumer.signal_shutdown()

        mock1 = Mock(side_effect=mock_callback)

        register_subscriber(self.registration_key)(mock1)
        sub = self.create_subscription()

        expected_calls = [
            call(normalize_payload(self.valid_payload), sub),
            call(normalize_payload(valid_wrapper_2["payload"]), sub),
        ]
        consumer.run()

        mock1.assert_has_calls(expected_calls)

        expected_calls = [call(normalize_payload(valid_wrapper_3["payload"]), sub)]
        mock1.reset_mock()

        consumer.run()

        mock1.assert_has_calls(expected_calls)

    @mock.patch("sentry.snuba.query_subscription_consumer.QuerySubscriptionConsumer.commit_offsets")
    def test_batch_timeout(self, commit_offset_mock):
        self.producer.produce(self.topic, json.dumps(self.valid_wrapper))
        self.producer.flush()

        with mock.patch.dict(topic_to_dataset, {self.topic: Dataset.Metrics}):
            consumer = QuerySubscriptionConsumer(
                "hi", topic=self.topic, commit_batch_size=100, commit_batch_timeout_ms=1
            )

        def mock_callback(*args, **kwargs):
            time.sleep(0.1)
            consumer.signal_shutdown()

        mock1 = Mock(side_effect=mock_callback)

        register_subscriber(self.registration_key)(mock1)
        self.create_subscription()

        consumer.run()
        # Once on revoke, once on shutdown, and once due to batch timeout
        assert len(commit_offset_mock.call_args_list) == 3
