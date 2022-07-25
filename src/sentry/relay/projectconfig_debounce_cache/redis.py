from sentry.relay.projectconfig_debounce_cache.base import ProjectConfigDebounceCache
from sentry.utils import metrics
from sentry.utils.redis import get_dynamic_cluster_from_options, validate_dynamic_cluster

REDIS_CACHE_TIMEOUT = 3600  # 1 hr


class RedisProjectConfigDebounceCache(ProjectConfigDebounceCache):
    def __init__(self, **options):
        self._key_prefix = options.pop("key_prefix", "relayconfig-debounce")
        self._debounce_ttl = options.pop("debounce_ttl", REDIS_CACHE_TIMEOUT)
        self.is_redis_cluster, self.cluster, options = get_dynamic_cluster_from_options(
            "SENTRY_RELAY_PROJECTCONFIG_DEBOUNCE_CACHE_OPTIONS", options
        )

        super().__init__(**options)

    def _get_redis_key(self, public_key, project_id, organization_id):
        if organization_id:
            return f"{self._key_prefix}:o:{organization_id}"
        elif project_id:
            return f"{self._key_prefix}:p:{project_id}"
        elif public_key:
            return f"{self._key_prefix}:k:{public_key}"
        else:
            raise ValueError()

    def validate(self):
        validate_dynamic_cluster(self.is_redis_cluster, self.cluster)

    def _get_redis_client(self, routing_key):
        if self.is_redis_cluster:
            return self.cluster
        else:
            return self.cluster.get_local_client_for_key(routing_key)

    def is_debounced(self, *, public_key, project_id, organization_id):
        if organization_id:
            key = self._get_redis_key(
                public_key=None, project_id=None, organization_id=organization_id
            )
            client = self._get_redis_client(key)
            if client.get(key):
                return True
        if project_id:
            key = self._get_redis_key(public_key=None, project_id=project_id, organization_id=None)
            client = self._get_redis_client(key)
            if client.get(key):
                return True
        if public_key:
            key = self._get_redis_key(public_key=public_key, project_id=None, organization_id=None)
            client = self._get_redis_client(key)
            if client.get(key):
                return True
        return False

    def debounce(self, *, public_key, project_id, organization_id):
        key = self._get_redis_key(public_key, project_id, organization_id)
        client = self._get_redis_client(key)
        client.setex(key, self._debounce_ttl, 1)
        metrics.incr("relay.projectconfig_debounce_cache.debounce")

    def mark_task_done(self, *, public_key, project_id, organization_id):
        key = self._get_redis_key(public_key, project_id, organization_id)
        client = self._get_redis_client(key)
        ret = client.delete(key)
        metrics.incr("relay.projectconfig_debounce_cache.task_done")
        return ret
