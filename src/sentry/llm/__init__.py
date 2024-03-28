from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import LLMBase

backend = LazyServiceWrapper(
    LLMBase,
    settings.SENTRY_LLM,
    settings.SENTRY_LLM_OPTIONS,
)

backend.expose(locals())
