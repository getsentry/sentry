import uuid

from django.test.utils import override_settings

from sentry.ratelimits.redis import RedisRateLimiter
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.redis import get_redis_cluster_default_options


@override_settings(
    SENTRY_PROCESSING_SERVICES={"redis": {"redis": "cluster"}},
    SENTRY_RATE_LIMIT_REDIS_CLUSTER="cluster",
)
@override_options(get_redis_cluster_default_options(id="cluster"))
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
