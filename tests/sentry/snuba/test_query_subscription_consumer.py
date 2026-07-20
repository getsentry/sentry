import unittest
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from functools import cached_property
from typing import Any
from unittest import mock

import pytest
from sentry_kafka_schemas import get_codec

from sentry.conf.types.kafka_definition import Topic
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery
from sentry.snuba.query_subscriptions.consumer import (
    InvalidSchemaError,
    parse_message_value,
    register_subscriber,
    subscriber_registry,
)
from sentry.snuba.query_subscriptions.run import _process_subscription_message
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba
from sentry.utils import json

pytestmark = [requires_snuba]


@pytest.mark.snuba_ci
class BaseQuerySubscriptionTest:
    @cached_property
    def dataset(self) -> Dataset:
        return Dataset.Metrics

    @cached_property
    def topic(self) -> str:
        return Topic.METRICS_SUBSCRIPTIONS_RESULTS.value

    @cached_property
    def jsoncodec(self) -> Any:
        return get_codec(self.topic)

    @cached_property
    def valid_wrapper(self) -> dict[str, Any]:
        return {"version": 3, "payload": self.valid_payload}

    @cached_property
    def valid_payload(self) -> dict[str, Any]:
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


class HandleMessageTest(BaseQuerySubscriptionTest, TestCase):
    @pytest.fixture(autouse=True)
    def _setup_metrics(self) -> object:
        with mock.patch("sentry.utils.metrics") as self.metrics:
            yield

    def test_raw_subscription_task(self) -> None:
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
        _process_subscription_message(json.dumps(data).encode("utf-8"), self.dataset)

        data = deepcopy(data)
        data["payload"]["values"] = data["payload"]["result"]
        data["payload"].pop("result")
        data["payload"].pop("request")
        data["payload"]["timestamp"] = datetime.fromisoformat(data["payload"]["timestamp"]).replace(
            tzinfo=timezone.utc
        )
        mock_callback.assert_called_once_with(data["payload"], sub)


class ParseMessageValueTest(BaseQuerySubscriptionTest, unittest.TestCase):
    def run_test(self, message: Any) -> None:
        parse_message_value(json.dumps(message).encode(), self.jsoncodec)

    def run_invalid_schema_test(self, message: Any) -> None:
        with pytest.raises(InvalidSchemaError):
            self.run_test(message)

    def run_invalid_payload_test(
        self, remove_fields: Any = None, update_fields: Any = None
    ) -> None:
        payload = deepcopy(self.valid_payload)
        if remove_fields:
            for field in remove_fields:
                payload.pop(field)
        if update_fields:
            payload.update(update_fields)
        self.run_invalid_schema_test({"version": 3, "payload": payload})

    def test_invalid_payload(self) -> None:
        self.run_invalid_payload_test(remove_fields=["subscription_id"])
        self.run_invalid_payload_test(remove_fields=["result"])
        self.run_invalid_payload_test(remove_fields=["timestamp"])
        self.run_invalid_payload_test(remove_fields=["entity"])
        self.run_invalid_payload_test(update_fields={"subscription_id": ""})
        self.run_invalid_payload_test(update_fields={"result": {}})
        self.run_invalid_payload_test(update_fields={"result": {"hello": "hi"}})
        self.run_invalid_payload_test(update_fields={"timestamp": -1})
        self.run_invalid_payload_test(update_fields={"entity": -1})

    def test_invalid_version(self) -> None:
        with pytest.raises(InvalidSchemaError) as excinfo:
            self.run_test({"version": 50, "payload": self.valid_payload})
        assert str(excinfo.value) == "Message wrapper does not match schema"

    def test_valid(self) -> None:
        self.run_test({"version": 3, "payload": self.valid_payload})

    def test_valid_nan(self) -> None:
        payload = deepcopy(self.valid_payload)
        payload["result"]["data"][0]["hello"] = float("nan")
        self.run_test({"version": 3, "payload": payload})

    def test_invalid_wrapper(self) -> None:
        self.run_invalid_schema_test({})
        self.run_invalid_schema_test({"version": 1})
        self.run_invalid_schema_test({"payload": self.valid_payload})


class RegisterSubscriberTest(unittest.TestCase):
    def setUp(self) -> None:
        self.orig_registry = deepcopy(subscriber_registry)

    def tearDown(self) -> None:
        subscriber_registry.clear()
        subscriber_registry.update(self.orig_registry)

    def test_register(self) -> None:
        callback = lambda a, b: None
        other_callback = lambda a, b: None
        register_subscriber("hello")(callback)
        assert subscriber_registry["hello"] is callback
        register_subscriber("goodbye")(other_callback)
        assert subscriber_registry["goodbye"] is other_callback

    def test_already_registered(self) -> None:
        callback = lambda a, b: None
        other_callback = lambda a, b: None
        register_subscriber("hello")(callback)
        assert subscriber_registry["hello"] == callback
        with pytest.raises(Exception) as excinfo:
            register_subscriber("hello")(other_callback)
        assert str(excinfo.value) == "Handler already registered for hello"
