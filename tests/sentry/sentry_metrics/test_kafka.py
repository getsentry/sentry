from datetime import datetime
from unittest import TestCase

import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.backends.local.backend import LocalBroker, LocalProducer
from arroyo.backends.local.storages.memory import MemoryMessageStorage
from arroyo.types import Partition, Topic
from arroyo.utils.clock import MockedClock as Clock

from sentry.sentry_metrics.client.kafka import KafkaMetricsBackend
from sentry.testutils.metrics_backend import GenericMetricsTestMixIn
from sentry.utils import json


class KafkaMetricsInterfaceTest(GenericMetricsTestMixIn, TestCase):
    @pytest.mark.django_db
    def test_produce_metrics(self) -> None:
        generic_metrics_backend = KafkaMetricsBackend()
        # For testing, we are calling close() here because we
        # are swapping out the KafkaProducer
        # with a LocalProducer, but regardless,
        # close() must always be called in order to close
        # the backend's KafkaProducer
        generic_metrics_backend.close()

        my_topic = Topic("my-topic")
        clock = Clock()
        broker_storage: MemoryMessageStorage[KafkaPayload] = MemoryMessageStorage()
        broker: LocalBroker[KafkaPayload] = LocalBroker(broker_storage, clock)
        broker.create_topic(my_topic, partitions=1)

        generic_metrics_backend.producer = LocalProducer(broker)
        generic_metrics_backend.kafka_topic = my_topic

        # produce a counter metric onto the second offset
        generic_metrics_backend.counter(
            self.use_case_id,
            self.org_id,
            self.project_id,
            self.metric_name,
            self.counter_value,
            self.metrics_tags,
            self.unit,
        )

        counter_metric = {
            "org_id": self.org_id,
            "project_id": self.project_id,
            "name": self.get_mri(self.metric_name, "c", self.use_case_id, self.unit),
            "value": self.counter_value,
            "timestamp": int(datetime.now().timestamp()),
            "tags": self.metrics_tags,
            "retention_days": self.retention_days,
            "type": "c",
        }

        counter_value = json.dumps(counter_metric).encode("utf-8")

        produced_message = broker_storage.consume(Partition(my_topic, 0), 0)
        assert produced_message is not None
        assert produced_message.payload.value == counter_value
        # check that there's no other remaining message in the topic
        assert broker_storage.consume(Partition(my_topic, 0), 1) is None
