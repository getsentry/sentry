from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

__all__ = ("for_organization_member_invite", "RateLimiter")

from .base import RateLimiter  # NOQA

backend = LazyServiceWrapper(
    RateLimiter, settings.SENTRY_RATELIMITER, settings.SENTRY_RATELIMITER_OPTIONS
)
backend.expose(locals())

from .utils import for_organization_member_invite
