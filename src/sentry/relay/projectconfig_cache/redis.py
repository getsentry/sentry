import logging
import random

import zstandard

from sentry import options
from sentry.relay.projectconfig_cache.base import ProjectConfigCache
from sentry.utils import json, metrics, redis
from sentry.utils.redis import validate_dynamic_cluster

REDIS_CACHE_TIMEOUT = 3600  # 1 hr
COMPRESSION_OPTION = "relay.project-config-cache-compress"
COMPRESSION_LEVEL = 9  # TODO: is this too much for Relay decompression?

logger = logging.getLogger(__name__)


def _use_compression(public_key: str) -> bool:
    option_value = options.get(COMPRESSION_OPTION)
    try:
        return public_key in option_value
    except TypeError:
        try:
            return random.random() < option_value
        except TypeError:
            logger.error("Invalid value for option %r: %r", COMPRESSION_OPTION, option_value)
    return False


class RedisProjectConfigCache(ProjectConfigCache):
    def __init__(self, **options):
        cluster_key = options.get("cluster", "default")
        self.cluster = redis.redis_clusters.get(cluster_key)

        super().__init__(**options)

    def validate(self):
        validate_dynamic_cluster(True, self.cluster)

    def __get_redis_key(self, public_key):
        return f"relayconfig:{public_key}"

    def set_many(self, configs):
        metrics.incr("relay.projectconfig_cache.write", amount=len(configs), tags={"action": "set"})

        # Note: Those are multiple pipelines, one per cluster node
        p = self.cluster.pipeline()
        for public_key, config in configs.items():
            value = json.dumps(config)
            if _use_compression(public_key):
                value = zstandard.compress(value.encode(), level=COMPRESSION_LEVEL)
            p.setex(self.__get_redis_key(public_key), REDIS_CACHE_TIMEOUT, value)

        p.execute()

    def delete_many(self, public_keys):
        # Note: Those are multiple pipelines, one per cluster node
        with self.cluster.pipeline() as p:
            for public_key in public_keys:
                p.delete(self.__get_redis_key(public_key))
            return_values = p.execute()

        metrics.incr(
            "relay.projectconfig_cache.write", amount=sum(return_values), tags={"action": "delete"}
        )

    def get(self, public_key):
        rv = self.cluster.get(self.__get_redis_key(public_key))
        if rv is not None:
            try:
                rv = zstandard.decompress(rv).decode()
            except TypeError:
                # str instead of bytes, assume raw json
                pass
            return json.loads(rv)
        return None
