from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import RateLimiter  # NOQA
from .decorator import build_rate_limit_key, rate_limit_endpoint  # NOQA

backend = LazyServiceWrapper(
    RateLimiter, settings.SENTRY_RATELIMITER, settings.SENTRY_RATELIMITER_OPTIONS
)
backend.expose(locals())
