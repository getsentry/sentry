from sentry.utils.services import Service


class RateLimiter(Service):
    __all__ = ("is_limited", "validate", "current_value")

    window = 60

    def is_limited(self, key, limit, project=None, window=None):
        return False

    def current_value(self, key, project=None, window=None):
        return 0
