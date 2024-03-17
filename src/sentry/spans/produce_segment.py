from __future__ import annotations

import logging

from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from arroyo.types import Message, Value
from confluent_kafka import KafkaException
from django.conf import settings

from sentry.conf.types.kafka_definition import Topic
from sentry.spans.consumers.recombine.factory import process_message
from sentry.utils.arroyo_producer import SingletonProducer
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

logger = logging.getLogger(__name__)


def _get_producer() -> KafkaProducer:
    cluster_name = get_topic_definition(Topic.BUFFERED_SEGMENTS)["cluster"]
    producer_config = get_kafka_producer_cluster_options(cluster_name)
    producer_config.pop("compression.type", None)
    producer_config.pop("message.max.bytes", None)
    return KafkaProducer(build_kafka_configuration(default_config=producer_config))


_segments_producer = SingletonProducer(_get_producer)


def prepare_message(segments) -> bytes:
    segment_str = b",".join(segments)
    return b'{"spans": [' + segment_str + b"]}"


def produce_segment_to_kafka(segments) -> None:
    if segments is None or len(segments) == 0:
        return

    payload_data = prepare_message(segments)
    payload = KafkaPayload(None, payload_data, [])
    if settings.SENTRY_EVENTSTREAM != "sentry.eventstream.kafka.KafkaEventStream":
        # If we're not running Kafka then we're just in dev.
        # Skip producing to Kafka and just process the message directly
        process_message(Message(Value(payload=payload, committable={})))
        return

    try:
        topic = get_topic_definition(Topic.BUFFERED_SEGMENTS)["real_topic_name"]
        _segments_producer.produce(ArroyoTopic(topic), payload)
    except KafkaException:
        logger.exception("Failed to produce segment to Kafka")
