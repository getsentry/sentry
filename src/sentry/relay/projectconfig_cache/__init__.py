from __future__ import absolute_import

from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import ProjectConfigCache

backend = LazyServiceWrapper(
    ProjectConfigCache,
    settings.SENTRY_RELAY_PROJECTCONFIG_CACHE,
    settings.SENTRY_RELAY_PROJECTCONFIG_CACHE_OPTIONS,
)

backend.expose(locals())
