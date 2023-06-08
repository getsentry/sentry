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
    # add comment for explanation
    metrics_backend.close()
    metrics_backend.producer = LocalProducer(broker)
    metrics_backend.kafka_topic = my_topic

    use_case_id = UseCaseID.TRANSACTIONS
    org_id = 1
    project_id = 1
    metric_name = "my_metric"
    values = [2, 3]
    tags = {"a": "b"}
    retention = 90

    metrics_backend.set(
        use_case_id, org_id, project_id, metric_name, values, tags, retention_days=retention
    )

    set_metric = {
        "org_id": org_id,
        "project_id": project_id,
        "name": build_mri(metric_name, "s", use_case_id, None),
        "value": values,
        "timestamp": int(datetime.now().timestamp()),
        "tags": tags,
        "retention_days": 90,
    }

    value = json.dumps(set_metric).encode("utf-8")

    produced_message = broker_storage.consume(Partition(my_topic, 0), 0)
    assert produced_message.payload is not None
    assert produced_message.payload.value == value
    assert broker_storage.consume(Partition(my_topic, 0), 1) is None
