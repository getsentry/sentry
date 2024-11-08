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
    _produce_to_kafka(UUID(config["subscription_id"]), UPTIME_CONFIGS_CODEC.encode(config))


def produce_config_removal(subscription_id: str):
    _produce_to_kafka(UUID(subscription_id), None)


def _produce_to_kafka(subscription_id: UUID, value: bytes | None) -> None:
    topic = get_topic_definition(Topic.UPTIME_CONFIGS)["real_topic_name"]
    payload = KafkaPayload(
        subscription_id.bytes,
        # Typically None is not allowed for the arroyo payload, but in this
        # case None produces a null value aka a tombstone.
        value,  # type: ignore[arg-type]
        [],
    )
    result = _configs_producer.produce(ArroyoTopic(topic), payload)
    result.result()
