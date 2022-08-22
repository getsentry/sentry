from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import TagKeyStatus, TagStorage  # NOQA
from .exceptions import *  # NOQA

LazyServiceWrapper(TagStorage, settings.SENTRY_TAGSTORE, settings.SENTRY_TAGSTORE_OPTIONS).expose(
    locals()
)
