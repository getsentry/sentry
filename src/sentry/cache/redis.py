"""
sentry.cache.redis
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from sentry.utils import json
from sentry.utils.redis import get_cluster_from_options

from .base import BaseCache


class RedisCache(BaseCache):
    key_expire = 60 * 60  # 1 hour

    def __init__(self, **options):
        self.cluster, options = get_cluster_from_options('SENTRY_CACHE_OPTIONS', options)
        self.client = self.cluster.get_routing_client()

        super(RedisCache, self).__init__(**options)

    def set(self, key, value, timeout, version=None):
        key = self.make_key(key, version=version)
        v = json.dumps(value)
        if timeout:
            self.client.setex(key, int(timeout), v)
        else:
            self.client.set(key, v)

    def delete(self, key, version=None):
        key = self.make_key(key, version=version)
        self.client.delete(key)

    def get(self, key, version=None):
        key = self.make_key(key, version=version)
        result = self.client.get(key)
        if result is not None:
            result = json.loads(result)
        return result
