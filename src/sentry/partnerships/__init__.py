from typing import int
from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import Partnership

backend = LazyServiceWrapper(
    Partnership, settings.SENTRY_PARTNERSHIPS, settings.SENTRY_PARTNERSHIP_OPTIONS
)
backend.expose(locals())
