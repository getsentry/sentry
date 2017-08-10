from __future__ import absolute_import

from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import RateLimiter  # NOQA

backend = LazyServiceWrapper(
    RateLimiter, settings.SENTRY_RATELIMITER, settings.SENTRY_RATELIMITER_OPTIONS
)
backend.expose(locals())
