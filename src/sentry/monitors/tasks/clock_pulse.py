from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import datetime, timezone
from functools import lru_cache

import msgpack
from arroyo import Partition
from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from confluent_kafka.admin import AdminClient, PartitionMetadata
from django.conf import settings

from sentry.conf.types.kafka_definition import Topic
from sentry.monitors.clock_dispatch import try_monitor_tasks_trigger
from sentry.monitors.types import ClockPulseMessage
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils.arroyo_producer import SingletonProducer
from sentry.utils.kafka_config import (
    get_kafka_admin_cluster_options,
    get_kafka_producer_cluster_options,
    get_topic_definition,
)

logger = logging.getLogger("sentry")


def _get_producer() -> KafkaProducer:
    cluster_name = get_topic_definition(Topic.INGEST_MONITORS)["cluster"]
    producer_config = get_kafka_producer_cluster_options(cluster_name)
    producer_config.pop("compression.type", None)
    producer_config.pop("message.max.bytes", None)
    return KafkaProducer(build_kafka_configuration(default_config=producer_config))


_checkin_producer = SingletonProducer(_get_producer)


@lru_cache(maxsize=None)
def _get_partitions() -> Mapping[int, PartitionMetadata]:
    topic_defn = get_topic_definition(Topic.INGEST_MONITORS)
    topic = topic_defn["real_topic_name"]

    conf = get_kafka_admin_cluster_options(topic_defn["cluster"])
    admin_client = AdminClient(conf)
    result = admin_client.list_topics(topic)
    topic_metadata = result.topics.get(topic)

    assert topic_metadata
    return topic_metadata.partitions


@instrumented_task(name="sentry.monitors.tasks.clock_pulse", silo_mode=SiloMode.REGION)
def clock_pulse(current_datetime=None):
    """
    This task is run once a minute when to produce 'clock pulses' into the
    monitor ingest topic. This is to ensure there is always a message in the
    topic that can drive all partition clocks, which dispatch monitor tasks.
    """
    if current_datetime is None:
        current_datetime = datetime.now(tz=timezone.utc)

    if settings.SENTRY_EVENTSTREAM != "sentry.eventstream.kafka.KafkaEventStream":
        # Directly trigger try_monitor_tasks_trigger in dev
        for partition in _get_partitions().values():
            try_monitor_tasks_trigger(current_datetime, partition.id)
        return

    message: ClockPulseMessage = {
        "message_type": "clock_pulse",
    }

    payload = KafkaPayload(None, msgpack.packb(message), [])

    # We create a clock-pulse (heart-beat) for EACH available partition in the
    # topic. This is a requirement to ensure that none of the partitions stall,
    # since the global clock is tied to the slowest partition.
    topic = ArroyoTopic(get_topic_definition(Topic.INGEST_MONITORS)["real_topic_name"])
    for partition in _get_partitions().values():
        dest = Partition(topic, partition.id)
        _checkin_producer.produce(dest, payload)
