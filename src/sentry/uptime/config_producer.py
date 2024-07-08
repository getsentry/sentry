from __future__ import annotations

from uuid import UUID

from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.uptime_configs_v1 import CheckConfig

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.utils.arroyo_producer import SingletonProducer
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

UPTIME_CONFIGS_CODEC: Codec[CheckConfig] = get_topic_codec(Topic.UPTIME_CONFIGS)


def _get_producer() -> KafkaProducer:
    cluster_name = get_topic_definition(Topic.UPTIME_CONFIGS)["cluster"]
    producer_config = get_kafka_producer_cluster_options(cluster_name)
    producer_config.pop("compression.type", None)
    producer_config.pop("message.max.bytes", None)
    return KafkaProducer(build_kafka_configuration(default_config=producer_config))


_configs_producer = SingletonProducer(_get_producer)


def produce_config(config: CheckConfig):
    topic = get_topic_definition(Topic.UPTIME_CONFIGS)["real_topic_name"]
    payload = KafkaPayload(
        UUID(config["subscription_id"]).bytes,
        UPTIME_CONFIGS_CODEC.encode(config),
        [],
    )
    _configs_producer.produce(ArroyoTopic(topic), payload)


def produce_config_removal(subscription_id: UUID):
    topic = get_topic_definition(Topic.UPTIME_CONFIGS)["real_topic_name"]
    payload = KafkaPayload(
        subscription_id.bytes,
        # Typically None is not allowed for the arroyo payload, but in this
        # case None produces a null value aka a tombstone.
        None,  # type: ignore[arg-type]
        [],
    )
    _configs_producer.produce(ArroyoTopic(topic), payload)
