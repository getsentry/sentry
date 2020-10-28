from __future__ import absolute_import

import six

from sentry.relay.projectconfig_cache.base import ProjectConfigCache
from sentry.utils import json
from sentry.utils.redis import get_dynamic_cluster_from_options, validate_dynamic_cluster


REDIS_CACHE_TIMEOUT = 3600  # 1 hr


class RedisProjectConfigCache(ProjectConfigCache):
    def __init__(self, **options):
        self.is_redis_cluster, self.cluster, options = get_dynamic_cluster_from_options(
            "SENTRY_RELAY_PROJECTCONFIG_CACHE_OPTIONS", options
        )
        super(RedisProjectConfigCache, self).__init__(**options)

    def validate(self):
        validate_dynamic_cluster(self.is_redis_cluster, self.cluster)

    def __get_redis_key(self, project_id):
        return "relayconfig:%s" % (project_id,)

    def __get_redis_client(self, routing_key):
        if self.is_redis_cluster:
            return self.cluster
        else:
            return self.cluster.get_local_client_for_key(routing_key)

    def set_many(self, configs):
        for project_id, config in six.iteritems(configs):
            # XXX(markus): Figure out how to do pipelining here. We may have
            # multiple routing keys (-> multiple clients).
            #
            # We cannot route by org, because Relay does not know the org when
            # fetching.

            key = self.__get_redis_key(project_id)
            client = self.__get_redis_client(key)
            client.setex(key, REDIS_CACHE_TIMEOUT, json.dumps(config))

    def delete_many(self, project_ids):
        for project_id in project_ids:
            # XXX(markus): Figure out how to do pipelining here. We may have
            # multiple routing keys (-> multiple clients).
            #
            # We cannot route by org, because Relay does not know the org when
            # fetching.

            key = self.__get_redis_key(project_id)
            client = self.__get_redis_client(key)
            client.delete(key)

    def get(self, project_id):
        key = self.__get_redis_key(project_id)
        client = self.__get_redis_client(key)
        rv = client.get(key)
        if rv is not None:
            return json.loads(rv)
        return None
