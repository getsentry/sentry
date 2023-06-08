from datetime import datetime

from arroyo.backends.kafka import KafkaPayload
from arroyo.backends.local.backend import LocalBroker, LocalProducer
from arroyo.backends.local.storages.memory import MemoryMessageStorage
from arroyo.types import Partition, Topic
from arroyo.utils.clock import TestingClock as Clock

from sentry.sentry_metrics.kafka_metrics_interface import KafkaMetricsBackend, build_mri
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.utils import json


def test_produce() -> None:
    my_topic = Topic("my-topic")
    clock = Clock()
    broker_storage: MemoryMessageStorage[KafkaPayload] = MemoryMessageStorage()
    broker: LocalBroker[KafkaPayload] = LocalBroker(broker_storage, clock)
    broker.create_topic(my_topic, partitions=1)

    metrics_backend = KafkaMetricsBackend()
    metrics_backend.producer = LocalProducer(broker)
    metrics_backend.kafka_topic = my_topic
    metrics_backend.set(UseCaseID.TRANSACTIONS, 1, 1, "my_metric", [2, 3], {"a": "b"})

    set_metric = {
        "org_id": 1,
        "project_id": 1,
        "name": build_mri("my_metric", "s", UseCaseID.TRANSACTIONS, None),
        "value": [2, 3],
        "timestamp": int(datetime.now().timestamp()),
        "tags": {"a": "b"},
        "retention_days": 90,
    }

    value = json.dumps(set_metric).encode("utf-8")

    produced_message = broker_storage.consume(Partition(my_topic, 0), 0)
    assert produced_message is not None
    assert produced_message.payload.value == value
    assert broker_storage.consume(Partition(my_topic, 0), 1) is None
