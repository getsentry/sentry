"""
sentry.cache.redis
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django.conf import settings
from rb import Cluster
from threading import local

from sentry.utils import json


class RedisCache(local):
    key_expire = 60 * 60  # 1 hour

    def __init__(self, **options):
        if not options:
            # inherit default options from REDIS_OPTIONS
            options = settings.SENTRY_REDIS_OPTIONS

        options.setdefault('hosts', {
            0: {},
        })
        self.cluster = Cluster(options['hosts'])
        self.client = self.cluster.get_routing_client()

    def set(self, key, value, timeout):
        v = json.dumps(value)
        if timeout:
            self.client.setex(key, int(timeout), v)
        else:
            self.client.set(key, v)

    def delete(self, key):
        self.client.delete(key)

    def get(self, key):
        result = self.client.get(key)
        if result is not None:
            result = json.loads(result)
        return result
