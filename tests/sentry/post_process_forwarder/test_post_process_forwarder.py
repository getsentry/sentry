import os
import time
import uuid
from unittest.mock import patch

from arroyo.utils import metrics
from confluent_kafka import Producer
from confluent_kafka.admin import AdminClient
from django.conf import settings
from django.test import override_settings

from sentry.eventstream.kafka.dispatch import _get_task_kwargs_and_dispatch
from sentry.post_process_forwarder import PostProcessForwarder
from sentry.testutils import TestCase
from sentry.utils import json, kafka_config
from sentry.utils.batching_kafka_consumer import wait_for_topics

SENTRY_KAFKA_HOSTS = os.environ.get("SENTRY_KAFKA_HOSTS", "127.0.0.1:9092")
SENTRY_ZOOKEEPER_HOSTS = os.environ.get("SENTRY_ZOOKEEPER_HOSTS", "127.0.0.1:2181")
settings.KAFKA_CLUSTERS["default"] = {"common": {"bootstrap.servers": SENTRY_KAFKA_HOSTS}}


def kafka_message_payload():
    return [
        2,
        "insert",
        {
            "group_id": 43,
            "event_id": "fe0ee9a2bc3b415497bad68aaf70dc7f",
            "organization_id": 1,
            "project_id": 1,
            "primary_hash": "311ee66a5b8e697929804ceb1c456ffe",
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
    def _get_producer(self, cluster_name):
        conf = {
            "bootstrap.servers": settings.KAFKA_CLUSTERS[cluster_name]["common"][
                "bootstrap.servers"
            ],
            "session.timeout.ms": 6000,
        }
        return Producer(conf)

    def setUp(self):
        super().setUp()
        self.events_topic = f"events-{uuid.uuid4().hex}"
        self.commit_log_topic = f"events-commit-{uuid.uuid4().hex}"
        self.override_settings_cm = override_settings(
            KAFKA_EVENTS=self.events_topic,
            KAFKA_TRANSACTIONS=self.events_topic,
            KAFKA_TOPICS={
                self.events_topic: {"cluster": "default"},
            },
        )
        self.override_settings_cm.__enter__()

        cluster_options = kafka_config.get_kafka_admin_cluster_options(
            "default", {"allow.auto.create.topics": "true"}
        )
        self.admin_client = AdminClient(cluster_options)
        wait_for_topics(self.admin_client, [self.events_topic, self.commit_log_topic])

    def tearDown(self):
        super().tearDown()
        self.override_settings_cm.__exit__(None, None, None)
        self.admin_client.delete_topics([self.events_topic, self.commit_log_topic])
        metrics._metrics_backend = None

    @patch("sentry.eventstream.kafka.dispatch.dispatch_post_process_group_task", autospec=True)
    def test_post_process_forwarder_streaming_consumer(self, dispatch_post_process_group_task):
        consumer_group = f"consumer-{uuid.uuid1().hex}"
        synchronize_commit_group = f"sync-consumer-{uuid.uuid1().hex}"

        events_producer = self._get_producer("default")
        commit_log_producer = self._get_producer("default")
        message = json.dumps(kafka_message_payload()).encode()

        ppf = PostProcessForwarder(_get_task_kwargs_and_dispatch)
        consumer = ppf._build_streaming_consumer(
            consumer_group=consumer_group,
            topic=self.events_topic,
            commit_log_topic=self.commit_log_topic,
            synchronize_commit_group=synchronize_commit_group,
            concurrency=1,
            initial_offset_reset="earliest",
            strict_offset_reset=None,
        )

        # produce message to the events topic
        events_producer.produce(self.events_topic, message)
        assert events_producer.flush(5) == 0, "events producer did not successfully flush queue"

        # Move the committed offset forward for our synchronizing group.
        commit_log_producer.produce(
            self.commit_log_topic,
            key=f"{self.events_topic}:0:{synchronize_commit_group}".encode(),
            value=f"{1}".encode(),
        )
        assert (
            commit_log_producer.flush(5) == 0
        ), "snuba-commit-log producer did not successfully flush queue"

        # Run the loop for sometime
        for _ in range(3):
            consumer._run_once()
            time.sleep(1)

        # Verify that the task gets called once
        dispatch_post_process_group_task.assert_called_once_with(
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
        )

        consumer._shutdown()
