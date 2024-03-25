from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import FeedbackSpamDetectionBase

backend = LazyServiceWrapper(
    FeedbackSpamDetectionBase,
    settings.SENTRY_USER_FEEDBACK_SPAM,
    settings.SENTRY_USER_FEEDBACK_SPAM_OPTIONS,
)

backend.expose(locals())
