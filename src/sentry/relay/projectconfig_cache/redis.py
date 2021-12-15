from sentry.relay.projectconfig_cache.base import ProjectConfigCache
from sentry.utils import json, redis
from sentry.utils.redis import validate_dynamic_cluster

REDIS_CACHE_TIMEOUT = 3600  # 1 hr


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
        # Note: Those are multiple pipelines, one per cluster node
        p = self.cluster.pipeline()
        for public_key, config in configs.items():
            p.setex(self.__get_redis_key(public_key), REDIS_CACHE_TIMEOUT, json.dumps(config))

        p.execute()

    def delete_many(self, public_keys):
        # Note: Those are multiple pipelines, one per cluster node
        p = self.cluster.pipeline()
        for public_key in public_keys:
            p.delete(self.__get_redis_key(public_key))

        p.execute()

    def get(self, public_key):
        rv = self.cluster.get(self.__get_redis_key(public_key))
        if rv is not None:
            return json.loads(rv)
        return None
