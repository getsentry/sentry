from __future__ import absolute_import

from django.conf import settings

from sentry.utils.functional import LazyBackendWrapper

from .base import Newsletter  # NOQA


backend = LazyBackendWrapper(Newsletter, settings.SENTRY_NEWSLETTER,
                             settings.SENTRY_NEWSLETTER_OPTIONS)
backend.expose(locals())
