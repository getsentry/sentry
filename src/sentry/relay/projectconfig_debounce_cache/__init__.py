from typing import TYPE_CHECKING

from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import ProjectConfigDebounceCache

backend = LazyServiceWrapper(
    ProjectConfigDebounceCache,
    settings.SENTRY_RELAY_PROJECTCONFIG_DEBOUNCE_CACHE,
    {
        # The sentry.tasks.relay.build_project_config tasks scheduled on here has a deadline
        # of 10s.  This debounce_ttl should match.
        "debounce_ttl": 10,
        **settings.SENTRY_RELAY_PROJECTCONFIG_DEBOUNCE_CACHE_OPTIONS,
    },
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
