import logging

import zstandard

from sentry.relay.projectconfig_cache.base import ProjectConfigCache
from sentry.utils import json, metrics, redis
from sentry.utils.redis import validate_dynamic_cluster

REDIS_CACHE_TIMEOUT = 3600  # 1 hr
COMPRESSION_LEVEL = 3  # 3 is the default level of compression

logger = logging.getLogger(__name__)


class RedisProjectConfigCache(ProjectConfigCache):
    def __init__(self, **options):
        cluster_key = options.get("cluster", "default")
        self.cluster = redis.redis_clusters.get(cluster_key)

        read_cluster_key = options.get("read_cluster", cluster_key)
        self.cluster_read = redis.redis_clusters.get(read_cluster_key)

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
            serialized = json.dumps(config).encode()
            compressed = zstandard.compress(serialized, level=COMPRESSION_LEVEL)
            metrics.timing("relay.projectconfig_cache.uncompressed_size", len(serialized))
            metrics.timing("relay.projectconfig_cache.size", len(compressed))

            p.setex(self.__get_redis_key(public_key), REDIS_CACHE_TIMEOUT, compressed)

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
        rv = self.cluster_read.get(self.__get_redis_key(public_key))
        if rv is not None:
            try:
                rv = zstandard.decompress(rv).decode()
            except (TypeError, zstandard.ZstdError):
                # assume raw json
                pass
            return json.loads(rv)
        return None
