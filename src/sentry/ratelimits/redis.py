from time import time

from django.conf import settings
from redis.exceptions import RedisError
from sentry_sdk import capture_exception

from sentry.exceptions import InvalidConfiguration
from sentry.ratelimits.base import RateLimiter
from sentry.utils import redis
from sentry.utils.hashlib import md5_text


class RedisRateLimiter(RateLimiter):
    window = 60

    def __init__(self, **options):
        cluster_key = getattr(settings, "SENTRY_RATE_LIMIT_REDIS_CLUSTER", "default")
        self.client = redis.redis_clusters.get(cluster_key)

    def validate(self):
        try:
            self.client.ping()
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
            result = self.client.incr(key)
            self.client.expire(key, window)
            return result > limit
        except RedisError as e:
            # We don't want rate limited endpoints to fail when ratelimits
            # can't be updated. We do want to know when that happens.
            capture_exception(e)
            return False
