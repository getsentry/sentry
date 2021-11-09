import logging
from datetime import datetime, timezone
from unittest import mock
from unittest.mock import MagicMock, Mock, patch
from uuid import uuid4

import pytest
from confluent_kafka import Consumer, Producer
from confluent_kafka.admin import AdminClient
from django.conf import settings
from django.test import override_settings

from sentry.sentry_metrics.indexer.indexer_consumer import (
    MetricsIndexerWorker,
    get_metrics_consumer,
)
from sentry.sentry_metrics.indexer.postgres import PGStringIndexer
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.task_runner import TaskRunner
from sentry.utils import json, kafka_config
from sentry.utils.batching_kafka_consumer import wait_for_topics

logger = logging.getLogger(__name__)

ts = int(datetime.now(tz=timezone.utc).timestamp())
payload = {
    "name": "session",
    "tags": {
        "environment": "production",
        "release": "sentry-test@1.0.2",
        "session.status": "init",
    },
    "timestamp": ts,
    "type": "c",
    "value": 1.0,
    "org_id": 1,
    "project_id": 3,
}


def translate_payload():

    parsed = payload.copy()
    parsed["tags"] = {
        PGStringIndexer().resolve(string=k): PGStringIndexer().resolve(string=str(v))
        for k, v in payload["tags"].items()
    }
    parsed["metric_id"] = PGStringIndexer().resolve(string=payload["name"])
    # hard-coded retention days added in by the consumer
    parsed["retention_days"] = 90
    return parsed


class MetricsIndexerWorkerTest(TestCase):
    def setUp(self):
        super().setUp()

    def tearDown(self):
        super().tearDown()

    def test_without_exception(self):
        self.assert_metrics_indexer_worker()

    def test_with_exception(self):
        self.assert_metrics_indexer_worker(flush_return_value=1, with_exception=True)

    @pytest.mark.django_db
    @patch("confluent_kafka.Producer")
    def assert_metrics_indexer_worker(
        self, producer, metrics_payload=payload, flush_return_value=0, with_exception=False
    ):
        producer.produce = MagicMock()
        producer.flush = MagicMock(return_value=flush_return_value)

        metrics_worker = MetricsIndexerWorker(producer=producer)

        mock_message = Mock()
        mock_message.value = MagicMock(return_value=json.dumps(metrics_payload))

        parsed = metrics_worker.process_message(mock_message)
        assert parsed["tags"] == {
            PGStringIndexer().resolve(string=k): PGStringIndexer().resolve(string=str(v))
            for k, v in payload["tags"].items()
        }
        assert parsed["metric_id"] == PGStringIndexer().resolve(string=payload["name"])

        if with_exception:
            with pytest.raises(Exception, match="didn't get all the callbacks: 1 left"):
                metrics_worker.flush_batch([parsed])
        else:
            metrics_worker.flush_batch([parsed])
            producer.produce.assert_called_with(
                topic="snuba-metrics",
                key=None,
                value=json.dumps(parsed).encode(),
                on_delivery=metrics_worker.callback,
            )


class MetricsIndexerConsumerTest(TestCase):
    def _get_producer(self, topic):
        cluster_name = settings.KAFKA_TOPICS[topic]["cluster"]
        conf = {
            "bootstrap.servers": settings.KAFKA_CLUSTERS[cluster_name]["common"][
                "bootstrap.servers"
            ],
            "session.timeout.ms": 6000,
        }
        return Producer(conf)

    def setUp(self):
        super().setUp()
        self.ingest_topic = uuid4().hex
        self.snuba_topic = uuid4().hex
        self.override_settings_cm = override_settings(
            KAFKA_TOPICS={
                self.ingest_topic: {"cluster": "default", "topic": self.ingest_topic},
                self.snuba_topic: {"cluster": "default", "topic": self.snuba_topic},
            },
            KAFKA_SNUBA_METRICS=self.snuba_topic,
        )
        self.override_settings_cm.__enter__()

        cluster_options = kafka_config.get_kafka_admin_cluster_options(
            "default", {"allow.auto.create.topics": "true"}
        )
        self.admin_client = AdminClient(cluster_options)
        wait_for_topics(self.admin_client, [self.snuba_topic])

    def tearDown(self):
        super().tearDown()
        self.override_settings_cm.__exit__(None, None, None)
        self.admin_client.delete_topics([self.ingest_topic, self.snuba_topic])

    @pytest.mark.django_db
    @mock.patch("sentry.sentry_metrics.indexer.indexer_consumer.process_indexed_metrics")
    def test_metrics_consumer(self, mock_task):
        ingest_producer = self._get_producer(self.ingest_topic)
        message = json.dumps(payload).encode()

        # produce message to the dummy ingest-metrics topic
        ingest_producer.produce(self.ingest_topic, message)

        assert ingest_producer.flush() == 0

        options = {
            "max_batch_size": 1,
            "max_batch_time": 5000,
            "group_id": "test-metrics-indexer-consumer",
            "auto_offset_reset": "earliest",
        }
        batching_consumer = get_metrics_consumer(topic=self.ingest_topic, **options)

        # couldn't use _run_once() here because .poll() is called
        # with a 1 second timeout which seems to not be enough.
        msg = batching_consumer.consumer.poll(5)
        assert msg

        with TaskRunner():
            # _handle_message calls worker's process_message
            # and then we flush() to make sure we call flush_batch
            batching_consumer._handle_message(msg)
            batching_consumer._flush()

            # make sure we produced the message during flush_batch
            snuba_producer = batching_consumer.worker._MetricsIndexerWorker__producer
            assert snuba_producer.flush() == 0

            translated_msg = translate_payload()
            expected_msg = {k: translated_msg[k] for k in ["tags", "name", "org_id"]}
            mock_task.apply_async.assert_called_once_with(kwargs={"messages": [expected_msg]})

        # in order to test that the message we produced to the dummy
        # snuba-metrics topic was the message we expected, we make a
        # dummy consumer to subscribe to the topic
        snuba_metrics_consumer = Consumer(
            {
                "bootstrap.servers": "localhost:9092",
                "group.id": "test-snuba-metrics-consumer",
                "default.topic.config": {"auto.offset.reset": "earliest"},
            }
        )
        snuba_metrics_consumer.subscribe([self.snuba_topic])

        # once we have the message, we don't need the consumer anymore
        translated_msg = snuba_metrics_consumer.poll(5)
        snuba_metrics_consumer.close()
        assert translated_msg

        # finally test the payload of the translated message
        parsed = json.loads(translated_msg.value(), use_rapid_json=True)
        expected = translate_payload()
        # loading the json converts the keys to strings e.g. {"tags": {1: 3}} --> {"tags": {"1": 3}}
        assert parsed["tags"] == {str(k): v for k, v in expected["tags"].items()}
        assert parsed["metric_id"] == expected["metric_id"]
