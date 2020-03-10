from __future__ import absolute_import

from django.conf import settings

from sentry.utils.imports import import_string

from .base import CachedAttachment

__all__ = ["attachment_cache", "CachedAttachment"]





attachment_cache = import_string(settings.SENTRY_ATTACHMENTS)(**settings.SENTRY_ATTACHMENTS_OPTIONS)
