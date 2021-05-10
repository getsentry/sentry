from time import time

from redis.exceptions import RedisError
from sentry_sdk import capture_exception

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
            raise InvalidConfiguration(str(e))

    def is_limited(self, key, limit, project=None, window=None):
        if window is None:
            window = self.window

        key_hex = md5_text(key).hexdigest()
        bucket = int(time() / window)

        if project:
            key = f"rl:{key_hex}:{project.id}:{bucket}"
        else:
            key = f"rl:{key_hex}:{bucket}"

        try:
            with self.cluster.map() as client:
                result = client.incr(key)
                client.expire(key, window)
            return result.value > limit
        except RedisError as e:
            # We don't want rate limited endpoints to fail when ratelimits
            # can't be updated. We do want to know when that happens.
            capture_exception(e)
            return False
