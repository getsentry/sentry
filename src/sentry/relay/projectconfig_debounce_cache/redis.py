from sentry.relay.projectconfig_debounce_cache.base import ProjectConfigDebounceCache
from sentry.utils.redis import get_dynamic_cluster_from_options, validate_dynamic_cluster

REDIS_CACHE_TIMEOUT = 3600  # 1 hr


def _get_redis_key(project_id, organization_id):
    if organization_id:
        return f"relayconfig-debounce:o:{organization_id}"
    elif project_id:
        return f"relayconfig-debounce:p:{project_id}"
    else:
        raise ValueError()


class RedisProjectConfigDebounceCache(ProjectConfigDebounceCache):
    def __init__(self, **options):
        self.is_redis_cluster, self.cluster, options = get_dynamic_cluster_from_options(
            "SENTRY_RELAY_PROJECTCONFIG_DEBOUNCE_CACHE_OPTIONS", options
        )
        super().__init__(**options)

    def validate(self):
        validate_dynamic_cluster(self.is_redis_cluster, self.cluster)

    def __get_redis_client(self, routing_key):
        if self.is_redis_cluster:
            return self.cluster
        else:
            return self.cluster.get_local_client_for_key(routing_key)

    def check_is_debounced(self, project_id, organization_id):
        key = _get_redis_key(project_id, organization_id)
        client = self.__get_redis_client(key)
        if client.get(key):
            return True

        client.setex(key, REDIS_CACHE_TIMEOUT, 1)
        return False

    def mark_task_done(self, project_id, organization_id):
        key = _get_redis_key(project_id, organization_id)
        client = self.__get_redis_client(key)
        client.delete(key)
