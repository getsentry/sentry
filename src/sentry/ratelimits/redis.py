from __future__ import absolute_import

from time import time

from sentry.exceptions import InvalidConfiguration
from sentry.ratelimits.base import RateLimiter
from sentry.utils.redis import get_cluster_from_options


class RedisRateLimiter(RateLimiter):
    ttl = 60

    def __init__(self, **options):
        self.cluster, options = get_cluster_from_options('SENTRY_RATELIMITER_OPTIONS', options)

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
