from typing import TYPE_CHECKING

from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import ProjectConfigDebounceCache

backend = LazyServiceWrapper(
    ProjectConfigDebounceCache,
    settings.SENTRY_RELAY_PROJECTCONFIG_DEBOUNCE_CACHE,
    settings.SENTRY_RELAY_PROJECTCONFIG_DEBOUNCE_CACHE_OPTIONS,
)

backend.expose(locals())

invalidation = LazyServiceWrapper(
    ProjectConfigDebounceCache,
    settings.SENTRY_RELAY_PROJECTCONFIG_DEBOUNCE_CACHE,
    {
        "key_prefix": "relayconfig-invalidation-dedup",
        **settings.SENTRY_RELAY_PROJECTCONFIG_DEBOUNCE_CACHE_OPTIONS,
    },
)

if TYPE_CHECKING:
    mark_task_done = backend.mark_task_done
