from sentry.types.ratelimit import RateLimit, RateLimitCategory

RELAY_AUTH_RATE_LIMITS = {
    "default": {
        RateLimitCategory.IP: RateLimit(limit=200, window=1),
        RateLimitCategory.USER: RateLimit(limit=200, window=1),
        RateLimitCategory.ORGANIZATION: RateLimit(limit=200, window=1),
    }
}
