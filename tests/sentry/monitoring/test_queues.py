from datetime import datetime
from unittest.mock import Mock, patch

import msgpack
from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies.abstract import MessageRejected
from arroyo.types import BrokerValue, Message, Partition, Topic
from pytest import raises

from sentry import options
from sentry.monitoring.queues import (
    _list_queues_over_threshold,
    _unhealthy_consumer_key,
    queue_monitoring_cluster,
)
from sentry.profiles.consumers.process.factory import ProcessProfileStrategyFactory
from sentry.testutils.cases import TestCase
from sentry.utils import json


class TestMonitoringQueues(TestCase):
    @staticmethod
    def processing_factory():
        return ProcessProfileStrategyFactory()

    def test_list_queues_over_threshold(self):
        strike_threshold = 10
        with self.options(
            {
                "backpressure.monitor_queues.strike_threshold": strike_threshold,
            }
        ):
            queue_history = {
                "replays.process": strike_threshold - 1,
                "profiles.process": strike_threshold + 1,
            }
            strike_threshold = options.get("backpressure.monitor_queues.strike_threshold")
            under_threshold = _list_queues_over_threshold(strike_threshold, queue_history)

            assert under_threshold == {
                "replays.process": False,
                "profiles.process": True,
            }

    def test_backpressure_unhealthy(self):
        queue_name = _unhealthy_consumer_key("profiles")

        # Set the queue as unhealthy so it shouldn't process messages
        queue_monitoring_cluster.set(queue_name, "1")
        with self.options(
            {
                "backpressure.monitor_queues.enable_check": True,
                "backpressure.monitor_queues.check_interval_in_seconds": 0,
                "backpressure.monitor_queues.unhealthy_threshold": 0,
                "backpressure.monitor_queues.strike_threshold": 1,
            }
        ):
            with raises(MessageRejected):
                self.process_one_message()

    @patch("sentry.profiles.consumers.process.factory.process_profile_task.s")
    def test_backpressure_healthy(self, process_profile_task):
        queue_name = _unhealthy_consumer_key("profiles")

        # Set the queue as healthy
        queue_monitoring_cluster.delete(queue_name)
        with self.options(
            {
                "backpressure.monitor_queues.enable_check": True,
                "backpressure.monitor_queues.check_interval_in_seconds": 0,
                "backpressure.monitor_queues.unhealthy_threshold": 1000,
                "backpressure.monitor_queues.strike_threshold": 1,
            }
        ):
            self.process_one_message()

        process_profile_task.assert_called_once()

    @patch("sentry.profiles.consumers.process.factory.process_profile_task.s")
    def test_backpressure_not_enabled(self, process_profile_task):
        with self.options(
            {
                "backpressure.monitor_queues.enable_check": False,
            }
        ):
            self.process_one_message()

        process_profile_task.assert_called_once()

    def process_one_message(self):
        processing_strategy = self.processing_factory().create_with_partitions(
            commit=Mock(), partitions=None
        )
        message_dict = {
            "organization_id": 1,
            "project_id": 1,
            "key_id": 1,
            "received": int(datetime.utcnow().timestamp()),
            "payload": json.dumps({"platform": "android", "profile": ""}),
        }
        payload = msgpack.packb(message_dict)

        processing_strategy.submit(
            Message(
                BrokerValue(
                    KafkaPayload(
                        b"key",
                        payload,
                        [],
                    ),
                    Partition(Topic("profiles"), 1),
                    1,
                    datetime.now(),
                )
            )
        )
        processing_strategy.poll()
        processing_strategy.join(1)
        processing_strategy.terminate()
