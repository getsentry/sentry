import importlib
import os
import time
import uuid
from typing import Any
from unittest.mock import patch

from arroyo.backends.kafka import KafkaPayload
from arroyo.processing import StreamProcessor
from arroyo.utils import metrics
from confluent_kafka import Producer
from confluent_kafka.admin import AdminClient
from django.conf import settings
from django.test import override_settings

from sentry.consumers import get_stream_processor
from sentry.eventstream.types import EventStreamEventType
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_kafka
from sentry.utils import json, kafka_config
from sentry.utils.batching_kafka_consumer import wait_for_topics

pytestmark = [requires_kafka]

SENTRY_KAFKA_HOSTS = os.environ.get("SENTRY_KAFKA_HOSTS", "127.0.0.1:9092")
settings.KAFKA_CLUSTERS["default"] = {"common": {"bootstrap.servers": SENTRY_KAFKA_HOSTS}}


def kafka_message_payload() -> Any:
    return [
        2,
        "insert",
        {
            "group_id": 43,
            "event_id": "fe0ee9a2bc3b415497bad68aaf70dc7f",
            "organization_id": 1,
            "project_id": 1,
            "primary_hash": "311ee66a5b8e697929804ceb1c456ffe",
            "data": {"received": time.time()},
            "message": "hello world",
        },
        {
            "is_new": False,
            "is_regression": None,
            "is_new_group_environment": False,
            "queue": "post_process_errors",
            "skip_consume": False,
            "group_states": None,
        },
    ]


class PostProcessForwarderTest(TestCase):
    def _get_producer(self, cluster_name: str) -> Producer:
        conf = settings.KAFKA_CLUSTERS[cluster_name]["common"]
        return Producer(conf)

    def setUp(self) -> None:
        super().setUp()
        self.consumer_and_topic_suffix = uuid.uuid4().hex
        self.events_topic = f"events-{self.consumer_and_topic_suffix}"
        self.commit_log_topic = f"events-commit-{self.consumer_and_topic_suffix}"
        self.override_settings_cm = override_settings(
            KAFKA_TOPIC_OVERRIDES={
                "events": self.events_topic,
                "transactions": self.events_topic,
            },
        )

        self.override_settings_cm.__enter__()

        cluster_options = kafka_config.get_kafka_admin_cluster_options(
            "default", {"allow.auto.create.topics": "true"}
        )
        self.admin_client = AdminClient(cluster_options)
        wait_for_topics(self.admin_client, [self.events_topic, self.commit_log_topic])

    def tearDown(self) -> None:
        super().tearDown()
        self.override_settings_cm.__exit__(None, None, None)
        self.admin_client.delete_topics([self.events_topic, self.commit_log_topic])
        metrics._metrics_backend = None

    def get_test_stream_processor(
        self, mode: str, consumer_group: str, synchronize_commit_group: str
    ) -> StreamProcessor[KafkaPayload]:
        return get_stream_processor(
            consumer_name="post-process-forwarder-errors",
            consumer_args=[f"--mode={mode}"],
            topic=self.events_topic,
            synchronize_commit_log_topic=self.commit_log_topic,
            synchronize_commit_group=synchronize_commit_group,
            cluster=None,
            group_id=consumer_group,
            auto_offset_reset="earliest",
            strict_offset_reset=False,
            join_timeout=None,
            max_poll_interval_ms=None,
            enable_dlq=False,
            healthcheck_file_path=None,
            enforce_schema=True,
        )

    def run_post_process_forwarder_streaming_consumer(self, ppf_mode: str) -> None:
        consumer_group = f"consumer-{self.consumer_and_topic_suffix}"
        synchronize_commit_group = f"sync-consumer-{self.consumer_and_topic_suffix}"

        events_producer = self._get_producer("default")
        commit_log_producer = self._get_producer("default")
        message = json.dumps(kafka_message_payload()).encode()

        import sentry.consumers

        importlib.reload(sentry.consumers)
        processor = self.get_test_stream_processor(
            mode=ppf_mode,
            consumer_group=consumer_group,
            synchronize_commit_group=synchronize_commit_group,
        )

        # produce message to the events topic
        events_producer.produce(self.events_topic, message)
        assert events_producer.flush(5) == 0, "events producer did not successfully flush queue"

        # Move the committed offset forward for our synchronizing group.
        commit_log_producer.produce(
            self.commit_log_topic,
            key=f"{self.events_topic}:0:{synchronize_commit_group}".encode(),
            value=b'{"orig_message_ts": 123456, "offset": 1}',
        )
        assert (
            commit_log_producer.flush(5) == 0
        ), "snuba-commit-log producer did not successfully flush queue"

        with patch("sentry.eventstream.kafka.dispatch.dispatch_post_process_group_task") as mock:
            # Run the loop for sometime
            for _ in range(3):
                processor._run_once()
                time.sleep(1)

            # Verify that the task gets called once
            mock.assert_called_once_with(
                event_id="fe0ee9a2bc3b415497bad68aaf70dc7f",
                project_id=1,
                group_id=43,
                primary_hash="311ee66a5b8e697929804ceb1c456ffe",
                is_new=False,
                is_regression=None,
                queue="post_process_errors",
                is_new_group_environment=False,
                group_states=None,
                occurrence_id=None,
                eventstream_type=EventStreamEventType.Error.value,
            )

        processor.signal_shutdown()
        processor.run()

    def test_multithreaded_post_process_forwarder(self) -> None:
        self.run_post_process_forwarder_streaming_consumer(ppf_mode="multithreaded")

    def test_multiprocess_post_process_forwarder(self) -> None:
        self.run_post_process_forwarder_streaming_consumer(ppf_mode="multiprocess")
