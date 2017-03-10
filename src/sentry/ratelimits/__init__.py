from __future__ import absolute_import

from django.conf import settings

from sentry.utils.functional import LazyBackendWrapper

from .base import RateLimiter  # NOQA


backend = LazyBackendWrapper(RateLimiter, settings.SENTRY_RATELIMITER,
                             settings.SENTRY_RATELIMITER_OPTIONS)
backend.expose(locals())
