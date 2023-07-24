from datetime import datetime

from arroyo.backends.kafka import KafkaPayload
from arroyo.backends.local.backend import LocalBroker, LocalProducer
from arroyo.backends.local.storages.memory import MemoryMessageStorage
from arroyo.types import Partition, Topic
from arroyo.utils.clock import TestingClock as Clock

from sentry.sentry_metrics import client
from sentry.sentry_metrics.client.kafka import build_mri
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.utils import json

use_case_id = UseCaseID.TRANSACTIONS
org_id = 2
project_id = 1
metric_name = "my_metric"
values = [2, 3]
tags = {"a": "b"}


metrics_backend = client.backend
# For testing, we are calling close() here because we
# are swapping out the KafkaProducer
# with a LocalProducer, but regardless,
# close() must always be called in order to close
# the backend's KafkaProducer
metrics_backend.close()


def test_produce_set() -> None:
    my_topic = Topic("my-topic")
    clock = Clock()
    broker_storage: MemoryMessageStorage[KafkaPayload] = MemoryMessageStorage()
    broker: LocalBroker[KafkaPayload] = LocalBroker(broker_storage, clock)
    broker.create_topic(my_topic, partitions=1)

    metrics_backend.producer = LocalProducer(broker)
    metrics_backend.kafka_topic = my_topic

    metrics_backend.set(
        use_case_id,
        org_id,
        project_id,
        metric_name,
        values,
        tags,
        unit=None,
    )

    set_metric = {
        "org_id": org_id,
        "project_id": project_id,
        "name": build_mri(metric_name, "s", use_case_id, None),
        "value": values,
        "timestamp": int(datetime.now().timestamp()),
        "tags": tags,
        "retention_days": 90,
        "type": "s",
    }

    value = json.dumps(set_metric).encode("utf-8")

    produced_message = broker_storage.consume(Partition(my_topic, 0), 0)
    assert produced_message is not None
    assert produced_message.payload.value == value
    assert broker_storage.consume(Partition(my_topic, 0), 1) is None


def test_produce_counter() -> None:
    my_topic = Topic("my-topic")
    clock = Clock()
    broker_storage: MemoryMessageStorage[KafkaPayload] = MemoryMessageStorage()
    broker: LocalBroker[KafkaPayload] = LocalBroker(broker_storage, clock)
    broker.create_topic(my_topic, partitions=1)

    metrics_backend.producer = LocalProducer(broker)
    metrics_backend.kafka_topic = my_topic

    metrics_backend.counter(
        use_case_id,
        org_id,
        project_id,
        metric_name,
        5,
        tags,
        unit=None,
    )

    counter_metric = {
        "org_id": org_id,
        "project_id": project_id,
        "name": build_mri(metric_name, "c", use_case_id, None),
        "value": 5,
        "timestamp": int(datetime.now().timestamp()),
        "tags": tags,
        "retention_days": 90,
        "type": "c",
    }

    value = json.dumps(counter_metric).encode("utf-8")

    produced_message = broker_storage.consume(Partition(my_topic, 0), 0)
    assert produced_message is not None
    assert produced_message.payload.value == value
    assert broker_storage.consume(Partition(my_topic, 0), 1) is None


def test_produce_distribution() -> None:
    my_topic = Topic("my-topic")
    clock = Clock()
    broker_storage: MemoryMessageStorage[KafkaPayload] = MemoryMessageStorage()
    broker: LocalBroker[KafkaPayload] = LocalBroker(broker_storage, clock)
    broker.create_topic(my_topic, partitions=1)

    metrics_backend.producer = LocalProducer(broker)
    metrics_backend.kafka_topic = my_topic

    metrics_backend.distribution(
        use_case_id,
        org_id,
        project_id,
        metric_name,
        values,
        tags,
        unit=None,
    )

    distribution_metric = {
        "org_id": org_id,
        "project_id": project_id,
        "name": build_mri(metric_name, "d", use_case_id, None),
        "value": values,
        "timestamp": int(datetime.now().timestamp()),
        "tags": tags,
        "retention_days": 90,
        "type": "d",
    }

    value = json.dumps(distribution_metric).encode("utf-8")

    produced_message = broker_storage.consume(Partition(my_topic, 0), 0)
    assert produced_message is not None
    assert produced_message.payload.value == value
    assert broker_storage.consume(Partition(my_topic, 0), 1) is None
