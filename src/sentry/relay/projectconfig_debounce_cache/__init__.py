from __future__ import absolute_import

from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import ProjectConfigDebounceCache

backend = LazyServiceWrapper(
    ProjectConfigDebounceCache,
    settings.SENTRY_RELAY_PROJECTCONFIG_DEBOUNCE_CACHE,
    settings.SENTRY_RELAY_PROJECTCONFIG_DEBOUNCE_CACHE_OPTIONS,
)

backend.expose(locals())
