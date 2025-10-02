__all__ = [
    "attachment_cache",
    "store_attachments_for_event",
    "get_attachments_for_event",
    "delete_ratelimited_attachments",
    "CachedAttachment",
    "MissingAttachmentChunks",
]

from collections.abc import Generator
from typing import Any

import sentry_sdk
from django.conf import settings

from sentry.utils.cache import cache_key_for_event
from sentry.utils.imports import import_string

from .base import BaseAttachmentCache, CachedAttachment, MissingAttachmentChunks

attachment_cache: BaseAttachmentCache = import_string(settings.SENTRY_ATTACHMENTS)(
    **settings.SENTRY_ATTACHMENTS_OPTIONS
)


@sentry_sdk.trace
def store_attachments_for_event(event: Any, attachments: list[CachedAttachment], timeout=None):
    """
    Stores the given list of `attachments` belonging to `event` for processing.

    Depending on feature flags:
    - the attachments themselves are stored in either `attachment_cache` or `objectstore` (still TODO)
    - the attachment metadata is stored in `attachment_cache` or the `event` (mutating the parameter)
    """

    put_metadata_into_event = False  # TODO
    cache_key = cache_key_for_event(event)
    attachments_metadata = attachment_cache.set(
        cache_key,
        attachments=attachments,
        timeout=timeout,
        set_metadata=not put_metadata_into_event,
    )
    del event["_attachments"]
    if put_metadata_into_event:
        event["_attachments"] = attachments_metadata


def get_attachments_for_event(event: Any) -> Generator[CachedAttachment]:
    """
    Retrieves the attachments belonging to the given `event`.

    These come either from the `attachment_cache`, or are embedded within the `event`, depending on feature flags.
    """

    if "_attachments" in event:
        return (
            CachedAttachment(cache=attachment_cache, **attachment)
            for attachment in event["_attachments"]
        )
    cache_key = cache_key_for_event(event)
    return attachment_cache.get(cache_key)


def delete_ratelimited_attachments(event: Any, attachments: list[CachedAttachment]):
    # TODO: make sure to remove rate-limited already stored attachments.
    # all other attachments which only exist in the cache, but are not stored will
    # be cleaned up here:
    cache_key = cache_key_for_event(event)
    attachment_cache.delete(cache_key)
