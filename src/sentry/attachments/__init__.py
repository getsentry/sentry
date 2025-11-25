from __future__ import annotations

__all__ = [
    "attachment_cache",
    "store_attachments_for_event",
    "get_attachments_for_event",
    "delete_cached_and_ratelimited_attachments",
    "CachedAttachment",
    "MissingAttachmentChunks",
]

from collections.abc import Generator
from typing import TYPE_CHECKING, Any

import sentry_sdk
from django.conf import settings

from sentry.objectstore import get_attachments_session
from sentry.utils.cache import cache_key_for_event
from sentry.utils.imports import import_string

from .base import BaseAttachmentCache, CachedAttachment, MissingAttachmentChunks

if TYPE_CHECKING:
    from sentry.models.project import Project

attachment_cache: BaseAttachmentCache = import_string(settings.SENTRY_ATTACHMENTS)(
    **settings.SENTRY_ATTACHMENTS_OPTIONS
)


@sentry_sdk.trace
def store_attachments_for_event(
    project: Project, event: Any, attachments: list[CachedAttachment], timeout=None
):
    """
    Stores the given list of `attachments` belonging to `event` for processing.

    The attachment metadata is stored within the `event`, and attachment payloads
    are stored either in the attachment cache, or in `objectstore` depending on feature flags.
    """

    cache_key = cache_key_for_event(event)
    attachments_metadata = attachment_cache.set(
        cache_key,
        attachments,
        timeout=timeout,
        project=project,
    )
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


@sentry_sdk.trace
def delete_cached_and_ratelimited_attachments(
    project: Project, event: Any, attachments: list[CachedAttachment]
):
    """
    This deletes all attachment payloads and metadata from the attachment cache
    (if those are stored there), as well as delete all the `rate_limited`
    attachments from the `objectstore`.
    Non-ratelimited attachments which are already stored in `objectstore` will
    be retained there for long-term storage.
    """
    for attachment in attachments:
        # deletes from objectstore if no long-term storage is desired
        if attachment.rate_limited and attachment.stored_id:
            get_attachments_session(project.organization_id, project.id).delete(
                attachment.stored_id
            )

        # unconditionally deletes any payloads from the attachment cache
        attachment.delete()

    # this cleans up the metadata from the attachments cache:
    # any payloads living in the attachments cache have been cleared by the
    # `attachment.delete()` call above.
    cache_key = cache_key_for_event(event)
    attachment_cache.delete(cache_key)
