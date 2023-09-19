import unittest
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from functools import cached_property
from unittest import mock

import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic
from dateutil.parser import parse as parse_date
from django.conf import settings
from sentry_kafka_schemas import get_codec

from sentry.runner.commands.run import DEFAULT_BLOCK_SIZE
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery
from sentry.snuba.query_subscriptions.consumer import (
    InvalidSchemaError,
    parse_message_value,
    register_subscriber,
    subscriber_registry,
)
from sentry.snuba.query_subscriptions.run import QuerySubscriptionStrategyFactory
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba
from sentry.utils import json

pytestmark = [requires_snuba]


@pytest.mark.snuba_ci
class BaseQuerySubscriptionTest:
    @cached_property
    def topic(self):
        return settings.KAFKA_METRICS_SUBSCRIPTIONS_RESULTS

    @cached_property
    def jsoncodec(self):
        return get_codec(self.topic)

    @cached_property
    def valid_wrapper(self):
        return {"version": 3, "payload": self.valid_payload}

    @cached_property
    def valid_payload(self):
        return {
            "subscription_id": "1234",
            "result": {
                "data": [{"hello": 50}],
                "meta": [{"name": "count", "type": "UInt64"}],
            },
            "request": {
                "some": "data",
                "query": """MATCH (metrics_counters) SELECT sum(value) AS value BY
                        tags[3] WHERE org_id = 1 AND project_id IN tuple(1) AND metric_id = 16
                        AND tags[3] IN tuple(13, 4)""",
            },
            "entity": "metrics_counters",
            "timestamp": "2020-01-01T01:23:45.1234",
        }

    def build_mock_message(self, data, topic=None):
        message = mock.Mock()
        message.value.return_value = json.dumps(data)
        if topic:
            message.topic.return_value = topic
        return message


class HandleMessageTest(BaseQuerySubscriptionTest, TestCase):
    @pytest.fixture(autouse=True)
    def _setup_metrics(self):
        with mock.patch("sentry.utils.metrics") as self.metrics:
            yield

    def test_arroyo_consumer(self):
        registration_key = "registered_test_2"
        mock_callback = mock.Mock()
        register_subscriber(registration_key)(mock_callback)
        with self.tasks():
            snuba_query = create_snuba_query(
                SnubaQuery.Type.ERROR,
                Dataset.Events,
                "hello",
                "count()",
                timedelta(minutes=10),
                timedelta(minutes=1),
                None,
            )
            sub = create_snuba_subscription(self.project, registration_key, snuba_query)
        sub.refresh_from_db()

        data = self.valid_wrapper
        data["payload"]["subscription_id"] = sub.subscription_id
        commit = mock.Mock()
        partition = Partition(Topic("test"), 0)
        strategy = QuerySubscriptionStrategyFactory(
            self.topic,
            1,
            1,
            1,
            DEFAULT_BLOCK_SIZE,
            DEFAULT_BLOCK_SIZE,
            # We have to disable multi_proc here, otherwise the consumer attempts to access the dev
            # database rather than the test one due to reinitialising Django
            multi_proc=False,
        ).create_with_partitions(commit, {partition: 0})
        message = self.build_mock_message(data, topic=self.topic)

        strategy.submit(
            Message(
                BrokerValue(
                    KafkaPayload(b"key", message.value().encode("utf-8"), [("should_drop", b"1")]),
                    partition,
                    1,
                    datetime.now(),
                )
            )
        )

        data = deepcopy(data)
        data["payload"]["values"] = data["payload"]["result"]
        data["payload"].pop("result")
        data["payload"].pop("request")
        data["payload"]["timestamp"] = parse_date(data["payload"]["timestamp"]).replace(
            tzinfo=timezone.utc
        )
        mock_callback.assert_called_once_with(data["payload"], sub)


class ParseMessageValueTest(BaseQuerySubscriptionTest, unittest.TestCase):
    def run_test(self, message):
        parse_message_value(json.dumps(message).encode(), self.jsoncodec)

    def run_invalid_schema_test(self, message):
        with pytest.raises(InvalidSchemaError):
            self.run_test(message)

    def run_invalid_payload_test(self, remove_fields=None, update_fields=None):
        payload = deepcopy(self.valid_payload)
        if remove_fields:
            for field in remove_fields:
                payload.pop(field)
        if update_fields:
            payload.update(update_fields)
        self.run_invalid_schema_test({"version": 3, "payload": payload})

    def test_invalid_payload(self):
        self.run_invalid_payload_test(remove_fields=["subscription_id"])
        self.run_invalid_payload_test(remove_fields=["result"])
        self.run_invalid_payload_test(remove_fields=["timestamp"])
        self.run_invalid_payload_test(remove_fields=["entity"])
        self.run_invalid_payload_test(update_fields={"subscription_id": ""})
        self.run_invalid_payload_test(update_fields={"result": {}})
        self.run_invalid_payload_test(update_fields={"result": {"hello": "hi"}})
        self.run_invalid_payload_test(update_fields={"timestamp": -1})
        self.run_invalid_payload_test(update_fields={"entity": -1})

    def test_invalid_version(self):
        with pytest.raises(InvalidSchemaError) as excinfo:
            self.run_test({"version": 50, "payload": self.valid_payload})
        assert str(excinfo.value) == "Message wrapper does not match schema"

    def test_valid(self):
        self.run_test({"version": 3, "payload": self.valid_payload})

    def test_valid_nan(self):
        payload = deepcopy(self.valid_payload)
        payload["result"]["data"][0]["hello"] = float("nan")
        self.run_test({"version": 3, "payload": payload})

    def test_invalid_wrapper(self):
        self.run_invalid_schema_test({})
        self.run_invalid_schema_test({"version": 1})
        self.run_invalid_schema_test({"payload": self.valid_payload})


class RegisterSubscriberTest(unittest.TestCase):
    def setUp(self):
        self.orig_registry = deepcopy(subscriber_registry)

    def tearDown(self):
        subscriber_registry.clear()
        subscriber_registry.update(self.orig_registry)

    def test_register(self):
        callback = lambda a, b: None
        other_callback = lambda a, b: None
        register_subscriber("hello")(callback)
        assert subscriber_registry["hello"] is callback
        register_subscriber("goodbye")(other_callback)
        assert subscriber_registry["goodbye"] is other_callback

    def test_already_registered(self):
        callback = lambda a, b: None
        other_callback = lambda a, b: None
        register_subscriber("hello")(callback)
        assert subscriber_registry["hello"] == callback
        with pytest.raises(Exception) as excinfo:
            register_subscriber("hello")(other_callback)
        assert str(excinfo.value) == "Handler already registered for hello"
