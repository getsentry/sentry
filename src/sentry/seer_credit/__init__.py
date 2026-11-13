from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import SeerCredit

backend = LazyServiceWrapper(
    SeerCredit, settings.SENTRY_SEER_CREDIT, settings.SENTRY_SEER_CREDIT_OPTIONS
)
backend.expose(locals())
