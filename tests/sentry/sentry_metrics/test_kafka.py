from datetime import datetime

from arroyo.backends.kafka import KafkaPayload
from arroyo.backends.local.backend import LocalBroker, LocalProducer
from arroyo.backends.local.storages.memory import MemoryMessageStorage
from arroyo.types import Partition, Topic
from arroyo.utils.clock import TestingClock as Clock

from sentry.sentry_metrics.client import generic_metrics_backend
from sentry.sentry_metrics.client.kafka import build_mri
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.utils import json

use_case_id = UseCaseID.TRANSACTIONS
org_id = 2
project_id = 1
metric_name = "my_metric"
values = [2, 3]
tags = {"a": "b"}


def test_produce_all() -> None:
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

    # produce a set metric onto the first offset
    generic_metrics_backend.set(
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

    set_value = json.dumps(set_metric).encode("utf-8")

    produced_message = broker_storage.consume(Partition(my_topic, 0), 0)
    assert produced_message is not None
    assert produced_message.payload.value == set_value
    # check that there's no other remaining message in the topic
    assert broker_storage.consume(Partition(my_topic, 0), 1) is None

    # produce a counter metric onto the second offset
    generic_metrics_backend.counter(
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

    counter_value = json.dumps(counter_metric).encode("utf-8")

    produced_message = broker_storage.consume(Partition(my_topic, 0), 1)
    assert produced_message is not None
    assert produced_message.payload.value == counter_value
    # check that there's no other remaining message in the topic
    assert broker_storage.consume(Partition(my_topic, 0), 2) is None

    # produce a distribution metric onto the third offset
    generic_metrics_backend.distribution(
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

    distribution_value = json.dumps(distribution_metric).encode("utf-8")

    produced_message = broker_storage.consume(Partition(my_topic, 0), 2)
    assert produced_message is not None
    assert produced_message.payload.value == distribution_value
    # check that there's no other remaining message in the topic
    assert broker_storage.consume(Partition(my_topic, 0), 3) is None
