from __future__ import absolute_import

from django.conf import settings
from nydus.db import create_cluster
from time import time

from sentry.ratelimits.base import RateLimiter


class RedisRateLimiter(RateLimiter):
    ttl = 60

    def __init__(self, **options):
        if not options:
            # inherit default options from REDIS_OPTIONS
            options = settings.SENTRY_REDIS_OPTIONS
        options.setdefault('hosts', {0: {}})
        options.setdefault('router', 'nydus.db.routers.keyvalue.PartitionRouter')

        self.conn = create_cluster({
            'engine': 'nydus.db.backends.redis.Redis',
            'router': options['router'],
            'hosts': options['hosts'],
        })

    def is_limited(self, project, key, limit):
        key = 'rl:%s:%s:%s' % (
            key, project.id, int(time() / self.ttl)
        )

        with self.conn.map() as conn:
            proj_result = conn.incr(key)
            conn.expire(key, self.ttl)

        if int(proj_result) > limit:
            return True
        return False
