from __future__ import annotations
from typing import int

from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.monitors_clock_tasks_v1 import MonitorsClockTasks

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.utils.arroyo_producer import SingletonProducer, get_arroyo_producer
from sentry.utils.kafka_config import get_topic_definition

MONITORS_CLOCK_TASKS_CODEC: Codec[MonitorsClockTasks] = get_topic_codec(Topic.MONITORS_CLOCK_TASKS)


def _get_producer() -> KafkaProducer:
    return get_arroyo_producer(
        name="sentry.monitors.clock_tasks.producer",
        topic=Topic.MONITORS_CLOCK_TASKS,
        exclude_config_keys=["compression.type", "message.max.bytes"],
    )


_clock_task_producer = SingletonProducer(_get_producer)


def produce_task(payload: KafkaPayload) -> None:
    topic = get_topic_definition(Topic.MONITORS_CLOCK_TASKS)["real_topic_name"]
    _clock_task_producer.produce(ArroyoTopic(topic), payload)
