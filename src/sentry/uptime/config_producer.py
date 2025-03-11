from __future__ import annotations

import logging
from uuid import UUID

import msgpack
from django.conf import settings
from redis import StrictRedis
from rediscluster import RedisCluster
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.uptime_configs_v1 import CheckConfig

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.conf.types.uptime import UptimeRegionConfig
from sentry.uptime.subscriptions.regions import get_region_config
from sentry.utils import redis

logger = logging.getLogger(__name__)

UPTIME_CONFIGS_CODEC: Codec[CheckConfig] = get_topic_codec(Topic.UPTIME_CONFIGS)


def produce_config(destination_region_slug: str, config: CheckConfig):
    _send_to_redis(
        destination_region_slug,
        UUID(config["subscription_id"]),
        UPTIME_CONFIGS_CODEC.encode(config),
    )


def produce_config_removal(destination_region_slug: str, subscription_id: str):
    _send_to_redis(destination_region_slug, UUID(subscription_id), None)


def get_partition_from_subscription_id(subscription_id: UUID) -> int:
    return int(subscription_id) % settings.UPTIME_CONFIG_PARTITIONS


def get_partition_keys(subscription_id: UUID, config: UptimeRegionConfig) -> tuple[str, str]:
    partition = get_partition_from_subscription_id(subscription_id)
    return (
        f"{config.config_redis_key_prefix}uptime:configs:{partition}",
        f"{config.config_redis_key_prefix}uptime:updates:{partition}",
    )


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

    key = subscription_id.hex
    config_key, update_key = get_partition_keys(subscription_id, region_config)
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
