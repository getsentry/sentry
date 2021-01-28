from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import Quota  # NOQA

backend = LazyServiceWrapper(Quota, settings.SENTRY_QUOTAS, settings.SENTRY_QUOTA_OPTIONS)
backend.expose(locals())
