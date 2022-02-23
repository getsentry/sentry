from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

__all__ = (
    "for_organization_member_invite",
    "above_rate_limit_check",
    "get_rate_limit_key",
    "get_rate_limit_value",
    "RateLimiter",
)

from .base import RateLimiter  # NOQA

backend = LazyServiceWrapper(
    RateLimiter, settings.SENTRY_RATELIMITER, settings.SENTRY_RATELIMITER_OPTIONS
)
backend.expose(locals())

from .utils import (
    above_rate_limit_check,
    for_organization_member_invite,
    get_rate_limit_key,
    get_rate_limit_value,
)
