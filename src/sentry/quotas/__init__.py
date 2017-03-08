from __future__ import absolute_import

from django.conf import settings

from sentry.utils.functional import LazyBackendWrapper

from .base import Quota  # NOQA


backend = LazyBackendWrapper(Quota, settings.SENTRY_QUOTAS,
                             settings.SENTRY_QUOTA_OPTIONS)
backend.expose(locals())
