from time import time
from typing import Optional

from redis.exceptions import RedisError
from sentry_sdk import capture_exception

from sentry.exceptions import InvalidConfiguration
from sentry.models.project import Project
from sentry.ratelimits.base import RateLimiter
from sentry.utils.hashlib import md5_text
from sentry.utils.redis import get_cluster_from_options


class RedisRateLimiter(RateLimiter):
    window = 60

    def __init__(self, **options):
        self.cluster, options = get_cluster_from_options("SENTRY_RATELIMITER_OPTIONS", options)

    def _construct_redis_key(
        self, key: str, project: Optional[Project] = None, window: Optional[int] = None
    ) -> str:
        """
        Construct a rate limit key using the args given. Key will have a format of:
        "rl:<key_hex>:[project?<project_id>:]<time_bucket>"
        where the time bucket is calculated by integer dividing the current time by the window
        """

        if window is None:
            window = self.window

        key_hex = md5_text(key).hexdigest()
        bucket = int(time() / window)
        if project:
            redis_key = f"rl:{key_hex}:{project.id}:{bucket}"
        else:
            redis_key = f"rl:{key_hex}:{bucket}"

        return redis_key

    def validate(self):
        try:
            with self.cluster.all() as client:
                client.ping()
        except Exception as e:
            raise InvalidConfiguration(str(e))

    def is_limited(self, key, limit, project=None, window=None):
        if window is None:
            window = self.window
        redis_key = self._construct_redis_key(key, project=project, window=window)

        try:
            with self.cluster.map() as client:
                result = client.incr(redis_key)
                client.expire(redis_key, window)
            return result.value > limit
        except RedisError as e:
            # We don't want rate limited endpoints to fail when ratelimits
            # can't be updated. We do want to know when that happens.
            capture_exception(e)
            return False

    def current_value(self, key: int, project: Project = None, window: int = None) -> int:
        redis_key = self._construct_redis_key(key, project=project, window=window)

        try:
            with self.cluster.map() as client:
                result = client.get(redis_key)
            current_count = result.value
            if current_count is None:
                # Key hasn't been created yet, therefore no hits done so far
                return 0
            return int(current_count)
        except RedisError as e:
            # Don't report any existing hits when there is a redis error.
            # Log what happened and move on
            capture_exception(e)
            return 0
