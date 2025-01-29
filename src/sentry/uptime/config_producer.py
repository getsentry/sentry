from __future__ import annotations

import logging
from uuid import UUID

import msgpack
from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from django.conf import settings
from redis import StrictRedis
from rediscluster import RedisCluster
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.uptime_configs_v1 import CheckConfig

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.uptime.subscriptions.regions import get_region_config
from sentry.utils import redis
from sentry.utils.arroyo_producer import SingletonProducer
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

logger = logging.getLogger(__name__)

UPTIME_CONFIGS_CODEC: Codec[CheckConfig] = get_topic_codec(Topic.UPTIME_CONFIGS)


def _get_producer() -> KafkaProducer:
    cluster_name = get_topic_definition(Topic.UPTIME_CONFIGS)["cluster"]
    producer_config = get_kafka_producer_cluster_options(cluster_name)
    producer_config.pop("compression.type", None)
    producer_config.pop("message.max.bytes", None)
    return KafkaProducer(build_kafka_configuration(default_config=producer_config))


_configs_producer = SingletonProducer(_get_producer)


def produce_config(destination_region_slug: str, config: CheckConfig):
    _produce_to_kafka(
        destination_region_slug,
        UUID(config["subscription_id"]),
        UPTIME_CONFIGS_CODEC.encode(config),
    )
    _send_to_redis(
        destination_region_slug,
        UUID(config["subscription_id"]),
        UPTIME_CONFIGS_CODEC.encode(config),
    )


def produce_config_removal(destination_region_slug: str, subscription_id: str):
    _produce_to_kafka(destination_region_slug, UUID(subscription_id), None)
    _send_to_redis(destination_region_slug, UUID(subscription_id), None)


def _produce_to_kafka(
    destination_region_slug: str, subscription_id: UUID, value: bytes | None
) -> None:
    region_config = get_region_config(destination_region_slug)
    if region_config is None:
        logger.error(
            "Attempted to create uptime subscription with invalid region slug",
            extra={"region_slug": destination_region_slug, "subscription_id": subscription_id},
        )
        return

    topic = get_topic_definition(region_config.config_topic)["real_topic_name"]
    payload = KafkaPayload(
        subscription_id.bytes,
        # Typically None is not allowed for the arroyo payload, but in this
        # case None produces a null value aka a tombstone.
        value,  # type: ignore[arg-type]
        [],
    )
    result = _configs_producer.produce(ArroyoTopic(topic), payload)
    result.result()


def get_partition_from_subscription_id(subscription_id: UUID) -> int:
    return int(subscription_id) % settings.UPTIME_CONFIG_PARTITIONS


def get_partition_keys(subscription_id: UUID) -> tuple[str, str]:
    partition = get_partition_from_subscription_id(subscription_id)
    return f"uptime:configs:{partition}", f"uptime:updates:{partition}"


def _send_to_redis(
    destination_region_slug: str, subscription_id: UUID, value: bytes | None
) -> None:
    region_config = get_region_config(destination_region_slug)
    if region_config is None:
        logger.error(
            "Attempted to create uptime subscription with invalid region slug",
            extra={"region_slug": destination_region_slug, "subscription_id": subscription_id},
        )
        return

    partition = get_partition_from_subscription_id(subscription_id)
    key = subscription_id.hex

    config_key = f"uptime:configs:{partition}"
    update_key = f"uptime:updates:{partition}"

    cluster: RedisCluster | StrictRedis = redis.redis_clusters.get_binary(
        region_config.config_redis_cluster
    )
    pipe = cluster.pipeline()
    if value is None:
        pipe.hdel(config_key, key)
        action = "delete"
    else:
        pipe.hset(config_key, key, value)
        action = "upsert"

    pipe.hset(
        update_key,
        subscription_id.hex,
        msgpack.packb(
            {
                "action": action,
                "subscription_id": subscription_id.hex,
            }
        ),
    )
    pipe.execute()
