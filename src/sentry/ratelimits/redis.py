from __future__ import annotations

import logging
from time import time
from typing import TYPE_CHECKING, Any

from django.conf import settings
from redis.exceptions import RedisError

from sentry.exceptions import InvalidConfiguration
from sentry.ratelimits.base import RateLimiter
from sentry.utils import redis
from sentry.utils.hashlib import md5_text

if TYPE_CHECKING:
    from sentry.models.project import Project

logger = logging.getLogger(__name__)


class RedisRateLimiter(RateLimiter):
    def __init__(self, **options: Any) -> None:
        cluster_key = getattr(settings, "SENTRY_RATE_LIMIT_REDIS_CLUSTER", "default")
        self.client = redis.redis_clusters.get(cluster_key)

    def _construct_redis_key(
        self, key: str, project: Project | None = None, window: int | None = None
    ) -> str:
        """
        Construct a rate limit key using the args given. Key will have a format of:
        "rl:<key_hex>:[project?<project_id>:]<time_bucket>"
        where the time bucket is calculated by integer dividing the current time by the window
        """

        if window is None or window == 0:
            window = self.window

        key_hex = md5_text(key).hexdigest()
        bucket = int(time() / window)

        redis_key = f"rl:{key_hex}"
        if project is not None:
            redis_key += f":{project.id}"
        redis_key += f":{bucket}"

        return redis_key

    def validate(self) -> None:
        try:
            self.client.ping()
        except Exception as e:
            raise InvalidConfiguration(str(e))

    def current_value(
        self, key: str, project: Project | None = None, window: int | None = None
    ) -> int:
        """
        Get the current value stored in redis for the rate limit with key "key" and said window
        """
        redis_key = self._construct_redis_key(key, project=project, window=window)

        try:
            current_count = self.client.get(redis_key)
        except RedisError:
            # Don't report any existing hits when there is a redis error.
            # Log what happened and move on
            logger.exception("Failed to retrieve current value from redis")
            return 0

        if current_count is None:
            # Key hasn't been created yet, therefore no hits done so far
            return 0
        return int(current_count)

    def is_limited_with_value(
        self, key: str, limit: int, project: Project | None = None, window: int | None = None
    ) -> tuple[bool, int]:
        """Does a rate limit check as well as return the new rate limit value"""
        if window is None or window == 0:
            window = self.window
        redis_key = self._construct_redis_key(key, project=project, window=window)

        expiration = window - int(time() % window)
        try:
            result = self.client.incr(redis_key)
            self.client.expire(redis_key, expiration)
        except RedisError:
            # We don't want rate limited endpoints to fail when ratelimits
            # can't be updated. We do want to know when that happens.
            logger.exception("Failed to retrieve current value from redis")
            return False, 0

        return result > limit, result
