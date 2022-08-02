from sentry.types.ratelimit import RateLimit, RateLimitCategory

RELAY_AUTH_RATE_LIMITS = {
    "default": {
        RateLimitCategory.IP: RateLimit(200, 1),
        RateLimitCategory.USER: RateLimit(200, 1),
        RateLimitCategory.ORGANIZATION: RateLimit(200, 1),
    }
}
