from django.conf import settings
from redis import RedisError

from sentry.utils import redis


class RedisRateLimitProvider:
    def __init__(self):
        self.cluster = redis.redis_clusters.get(settings.SENTRY_SCM_REDIS_CLUSTER)

    def get_and_set_rate_limit(
        self,
        total_key: str,
        usage_key: str,
        expiration: int,
    ) -> tuple[int | None, int]:
        """
        Get the request limit and incr/expire quota usage for the key.

        :param total_key: The location of the request limit.
        :param usage_key: The location of the quota counter.
        :param expiration: The number of seconds until the key expires.
        """
        try:
            with self.cluster.pipeline() as pipe:
                pipe.get(total_key)
                pipe.incr(usage_key)
                pipe.expire(usage_key, expiration)

                result = pipe.execute()
                return (int(result[0]) if result[0] is not None else None, result[1])
        except (RedisError, IndexError):
            # Fail open if we could not properly handle the rate-limits. We may have miss the
            # increment of the usage key. This will eventually show up as a consumption of shared
            # quota. This could lead to starvation if this function fails at significant rates and
            # request volume for the allocated referrers is high.
            return (None, 0)

    def get_accounted_usage(self, keys: list[str]) -> int:
        """Return the sum of a given set of keys."""
        try:
            with self.cluster.pipeline() as pipe:
                for key in keys:
                    pipe.get(key)

                values = pipe.execute(raise_on_error=True)
                assert len(values) == len(keys)
                return sum(int(k) for k in values if k is not None)
        except (AssertionError, RedisError):
            raise IndeterminateResult

    def set_key_values(self, kvs: dict[str, tuple[int, int | None]]) -> None:
        """For a given set of key, value pairs set them in the Redis Cluster."""
        try:
            with self.cluster.pipeline() as pipe:
                for key, (value, expiration) in kvs.items():
                    pipe.set(key, value, ex=expiration)
                pipe.execute()
        except RedisError:
            # Partial updates do not break the system. Shared quota or a total update may not
            # have been written. They can be written on the next request.
            return None


class IndeterminateResult(Exception): ...
