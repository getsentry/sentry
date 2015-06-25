from __future__ import absolute_import

from django.conf import settings

from sentry.utils.functional import LazyBackendWrapper

from .base import Buffer  # NOQA


backend = LazyBackendWrapper(Buffer, settings.SENTRY_BUFFER,
                             settings.SENTRY_BUFFER_OPTIONS)
backend.expose(locals())
