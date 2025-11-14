from typing import int
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory

RELAY_AUTH_RATE_LIMITS = RateLimitConfig(
    limit_overrides={
        "POST": {
            RateLimitCategory.IP: RateLimit(limit=200, window=1),
            RateLimitCategory.USER: RateLimit(limit=200, window=1),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=200, window=1),
        },
    }
)
