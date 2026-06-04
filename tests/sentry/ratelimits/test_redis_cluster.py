import uuid

from sentry.ratelimits.redis import RedisRateLimiter
from sentry.testutils.helpers.redis import use_redis_cluster


@use_redis_cluster(
    cluster_id="cluster", with_settings={"SENTRY_RATE_LIMIT_REDIS_CLUSTER": "cluster"}
)
def test_integration_is_limited_with_value_with() -> None:
    rate_limiter = RedisRateLimiter()
    key = uuid.uuid4().hex

    limited, value, reset_time = rate_limiter.is_limited_with_value(key=key, limit=2, window=60)
    assert not limited
    assert value == 1

    limited, value, reset_time = rate_limiter.is_limited_with_value(key=key, limit=2, window=60)
    assert not limited
    assert value == 2

    limited, value, reset_time = rate_limiter.is_limited_with_value(key=key, limit=2, window=60)
    assert limited
    assert value == 3
