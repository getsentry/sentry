from __future__ import absolute_import

import unittest
from copy import deepcopy
from datetime import timedelta

import mock
import six
import pytz
from dateutil.parser import parse as parse_date
from django.conf import settings
from exam import fixture, patcher

from sentry.utils import json
from sentry.utils.compat.mock import Mock
from sentry.snuba.models import QueryDatasets, QuerySubscription
from sentry.snuba.query_subscription_consumer import (
    InvalidMessageError,
    InvalidSchemaError,
    QuerySubscriptionConsumer,
    register_subscriber,
    subscriber_registry,
)
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import TestCase


class BaseQuerySubscriptionTest(object):
    @fixture
    def consumer(self):
        return QuerySubscriptionConsumer("hello")

    @fixture
    def valid_wrapper(self):
        return {"version": 2, "payload": self.valid_payload}

    @fixture
    def old_payload(self):
        return {
            "subscription_id": "1234",
            "values": {"data": [{"hello": 50}]},
            "timestamp": "2020-01-01T01:23:45.1234",
        }

    @fixture
    def valid_payload(self):
        return {
            "subscription_id": "1234",
            "result": {"data": [{"hello": 50}]},
            "request": {"some": "data"},
            "timestamp": "2020-01-01T01:23:45.1234",
        }

    def build_mock_message(self, data, topic=None):
        message = Mock()
        message.value.return_value = json.dumps(data)
        if topic:
            message.topic.return_value = topic
        return message


class HandleMessageTest(BaseQuerySubscriptionTest, TestCase):
    metrics = patcher("sentry.snuba.query_subscription_consumer.metrics")

    def test_no_subscription(self):
        with mock.patch("sentry.snuba.tasks._snuba_pool") as pool:
            pool.urlopen.return_value.status = 202
            self.consumer.handle_message(
                self.build_mock_message(
                    self.valid_wrapper, topic=settings.KAFKA_EVENTS_SUBSCRIPTIONS_RESULTS
                )
            )
            pool.urlopen.assert_called_once_with(
                "DELETE",
                "/{}/subscriptions/{}".format(
                    QueryDatasets.EVENTS.value, self.valid_payload["subscription_id"]
                ),
            )
        self.metrics.incr.assert_called_once_with(
            "snuba_query_subscriber.subscription_doesnt_exist"
        )

    def test_subscription_not_registered(self):
        sub = QuerySubscription.objects.create(
            project=self.project, type="unregistered", subscription_id="an_id"
        )
        data = self.valid_wrapper
        data["payload"]["subscription_id"] = sub.subscription_id
        self.consumer.handle_message(self.build_mock_message(data))
        self.metrics.incr.assert_called_once_with(
            "snuba_query_subscriber.subscription_type_not_registered"
        )

    def test_subscription_registered(self):
        registration_key = "registered_test"
        mock_callback = Mock()
        register_subscriber(registration_key)(mock_callback)
        with self.tasks():
            snuba_query = create_snuba_query(
                QueryDatasets.EVENTS,
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
        self.consumer.handle_message(self.build_mock_message(data))
        data = deepcopy(data)
        data["payload"]["values"] = data["payload"]["result"]
        data["payload"]["timestamp"] = parse_date(data["payload"]["timestamp"]).replace(
            tzinfo=pytz.utc
        )
        mock_callback.assert_called_once_with(data["payload"], sub)


class ParseMessageValueTest(BaseQuerySubscriptionTest, unittest.TestCase):
    def run_test(self, message):
        self.consumer.parse_message_value(json.dumps(message))

    def run_invalid_schema_test(self, message):
        with self.assertRaises(InvalidSchemaError):
            self.run_test(message)

    def run_invalid_payload_test(self, remove_fields=None, update_fields=None):
        payload = deepcopy(self.valid_payload)
        if remove_fields:
            for field in remove_fields:
                payload.pop(field)
        if update_fields:
            payload.update(update_fields)
        self.run_invalid_schema_test({"version": 2, "payload": payload})

    def test_invalid_payload(self):
        self.run_invalid_payload_test(remove_fields=["subscription_id"])
        self.run_invalid_payload_test(remove_fields=["result"])
        self.run_invalid_payload_test(remove_fields=["timestamp"])
        self.run_invalid_payload_test(update_fields={"subscription_id": ""})
        self.run_invalid_payload_test(update_fields={"result": {}})
        self.run_invalid_payload_test(update_fields={"result": {"hello": "hi"}})
        self.run_invalid_payload_test(update_fields={"timestamp": -1})

    def test_invalid_version(self):
        with self.assertRaises(InvalidMessageError) as cm:
            self.run_test({"version": 50, "payload": {}})
        assert six.text_type(cm.exception) == "Version specified in wrapper has no schema"

    def test_valid(self):
        self.run_test({"version": 2, "payload": self.valid_payload})

    def test_old_version(self):
        self.run_test({"version": 1, "payload": self.old_payload})

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
        callback = object()
        other_callback = object()
        register_subscriber("hello")(callback)
        assert subscriber_registry["hello"] == callback
        register_subscriber("goodbye")(other_callback)
        assert subscriber_registry["goodbye"] == other_callback

    def test_already_registered(self):
        callback = object()
        other_callback = object()
        register_subscriber("hello")(callback)
        assert subscriber_registry["hello"] == callback
        with self.assertRaises(Exception) as cm:
            register_subscriber("hello")(other_callback)
        assert six.text_type(cm.exception) == "Handler already registered for hello"
