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

if TYPE_CHECKING:
    check_is_debounced = backend.check_is_debounced
    mark_task_done = backend.mark_task_done
