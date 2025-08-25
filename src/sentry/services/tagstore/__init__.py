from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import TagKeyStatus, TagStorage  # NOQA
from .exceptions import *  # NOQA

backend = LazyServiceWrapper(TagStorage, settings.SENTRY_TAGSTORE, settings.SENTRY_TAGSTORE_OPTIONS)
backend.expose(locals())

# Searches the "flags" columns instead of "tags".
flag_backend = LazyServiceWrapper(
    TagStorage, settings.SENTRY_FLAGSTORE, settings.SENTRY_FLAGSTORE_OPTIONS
)
flag_backend.expose(locals())
