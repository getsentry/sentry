"""
sentry.cache.redis
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django.conf import settings
from nydus.db import create_cluster
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
        options.setdefault('router', 'nydus.db.routers.keyvalue.PartitionRouter')
        self.conn = create_cluster({
            'engine': 'nydus.db.backends.redis.Redis',
            'router': options['router'],
            'hosts': options['hosts'],
        })

    def _make_key(self, key):
        if key.startswith('e:'):
            return key
        return 'c:%s' % (key,)

    def set(self, key, value, timeout):
        key = self._make_key(key)
        with self.conn.map() as conn:
            conn.set(key, json.dumps(value))
            if timeout:
                conn.expire(key, timeout)

    def delete(self, key):
        key = self._make_key(key)
        self.conn.delete(key)

    def get(self, key):
        key = self._make_key(key)
        result = self.conn.get(key)
        if result is not None:
            result = json.loads(result)
        return result
