__all__ = ["attachment_cache", "CachedAttachment", "MissingAttachmentChunks"]

from django.conf import settings

from sentry.utils.imports import import_string

from .base import BaseAttachmentCache, CachedAttachment, MissingAttachmentChunks

attachment_cache: BaseAttachmentCache = import_string(settings.SENTRY_ATTACHMENTS)(
    **settings.SENTRY_ATTACHMENTS_OPTIONS
)
