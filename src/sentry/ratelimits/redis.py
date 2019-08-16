from __future__ import absolute_import

import six

from time import time

from sentry.exceptions import InvalidConfiguration
from sentry.ratelimits.base import RateLimiter
from sentry.utils.hashlib import md5_text
from sentry.utils.redis import get_cluster_from_options


class RedisRateLimiter(RateLimiter):
    window = 60

    def __init__(self, **options):
        self.cluster, options = get_cluster_from_options("SENTRY_RATELIMITER_OPTIONS", options)

    def validate(self):
        try:
            with self.cluster.all() as client:
                client.ping()
        except Exception as e:
            raise InvalidConfiguration(six.text_type(e))

    def is_limited(self, key, limit, project=None, window=None):
        if window is None:
            window = self.window

        key_hex = md5_text(key).hexdigest()
        bucket = int(time() / window)

        if project:
            key = "rl:%s:%s:%s" % (key_hex, project.id, bucket)
        else:
            key = "rl:%s:%s" % (key_hex, bucket)

        with self.cluster.map() as client:
            result = client.incr(key)
            client.expire(key, window)

        return result.value > limit
