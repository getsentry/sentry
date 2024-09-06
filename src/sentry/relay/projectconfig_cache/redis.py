import logging
from collections.abc import Mapping
from typing import Any

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
        self.cluster = redis.redis_clusters.get_binary(cluster_key)

        read_cluster_key = options.get("read_cluster", cluster_key)
        self.cluster_read = redis.redis_clusters.get_binary(read_cluster_key)

        super().__init__(**options)

    def validate(self):
        validate_dynamic_cluster(True, self.cluster)

    def __get_redis_key(self, public_key):
        return f"relayconfig:{public_key}"

    def __get_redis_rev_key(self, public_key):
        return f"{self.__get_redis_key(public_key)}.rev"

    def set_many(self, configs: dict[str, Mapping[str, Any]]):
        metrics.incr("relay.projectconfig_cache.write", amount=len(configs), tags={"action": "set"})

        # Note: Those are multiple pipelines, one per cluster node.
        p = self.cluster.pipeline(transaction=False)
        for public_key, config in configs.items():
            serialized = json.dumps(config).encode()
            compressed = zstandard.compress(serialized, level=COMPRESSION_LEVEL)
            metrics.distribution(
                "relay.projectconfig_cache.uncompressed_size", len(serialized), unit="byte"
            )
            metrics.distribution("relay.projectconfig_cache.size", len(compressed), unit="byte")

            p.setex(self.__get_redis_key(public_key), REDIS_CACHE_TIMEOUT, compressed)
            # Update the revision after updating the config, while not strictly necessary
            # this means when the reader is checking the revision before reading the key
            # the revision won't be updated already while the project config is still the old.
            #
            # Note: This is best effort! Readers using the revision key always need to use
            # the actual revision on the project config for consistency, the revision key can and
            # should only be used as an optimization. This is also why the used pipeline is not
            # made transactional.
            if rev := config.get("rev"):
                p.setex(self.__get_redis_rev_key(public_key), REDIS_CACHE_TIMEOUT, rev)

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
        rv_b = self.cluster_read.get(self.__get_redis_key(public_key))
        if rv_b is not None:
            try:
                rv = zstandard.decompress(rv_b).decode()
            except (TypeError, zstandard.ZstdError):
                # assume raw json
                rv = rv_b.decode()
            return json.loads(rv)
        return None

    def get_rev(self, public_key) -> str | None:
        if value := self.cluster_read.get(self.__get_redis_rev_key(public_key)):
            return value.decode()
        return None
