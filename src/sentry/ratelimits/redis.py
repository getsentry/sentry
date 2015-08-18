from __future__ import absolute_import

from django.conf import settings
from rb import Cluster
from time import time

from sentry.exceptions import InvalidConfiguration
from sentry.ratelimits.base import RateLimiter


class RedisRateLimiter(RateLimiter):
    ttl = 60

    def __init__(self, **options):
        if not options:
            # inherit default options from REDIS_OPTIONS
            options = settings.SENTRY_REDIS_OPTIONS
        options.setdefault('hosts', {0: {}})

        self.cluster = Cluster(options['hosts'])

    def validate(self):
        try:
            with self.cluster.all() as client:
                client.ping()
        except Exception as e:
            raise InvalidConfiguration(unicode(e))

    def is_limited(self, project, key, limit):
        key = 'rl:%s:%s:%s' % (
            key, project.id, int(time() / self.ttl)
        )

        with self.cluster.map() as client:
            proj_result = client.incr(key)
            client.expire(key, self.ttl)

        return proj_result.value > limit
