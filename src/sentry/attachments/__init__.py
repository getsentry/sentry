from __future__ import annotations

__all__ = [
    "attachment_cache",
    "store_attachments_for_event",
    "get_attachments_for_event",
    "delete_ratelimited_attachments",
    "CachedAttachment",
    "MissingAttachmentChunks",
]

from collections.abc import Generator
from typing import TYPE_CHECKING, Any

import sentry_sdk
from django.conf import settings

from sentry.objectstore import Client as ObjectstoreClient
from sentry.objectstore import attachments as objectstore_attachments
from sentry.options.rollout import in_random_rollout
from sentry.utils.cache import cache_key_for_event
from sentry.utils.imports import import_string

from .base import BaseAttachmentCache, CachedAttachment, MissingAttachmentChunks

if TYPE_CHECKING:
    from sentry.models.project import Project

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

    put_metadata_into_event = in_random_rollout("objectstore.processing_store.attachments")
    cache_key = cache_key_for_event(event)
    attachments_metadata = attachment_cache.set(
        cache_key,
        attachments,
        timeout=timeout,
        set_metadata=not put_metadata_into_event,
    )
    event.pop("_attachments", None)
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


def delete_ratelimited_attachments(
    project: Project, event: Any, attachments: list[CachedAttachment]
):
    """
    This deletes all the attachments that are `rate_limited` from `objectstore` in case they are stored,
    and it will also remove all the attachments from the attachments cache as well.
    """
    client: ObjectstoreClient | None = None
    for attachment in attachments:
        if attachment.rate_limited and attachment.stored_id:
            if client is None:
                client = objectstore_attachments.for_project(project.organization_id, project.id)
            client.delete(attachment.stored_id)

    # all other attachments which only exist in the cache but are not stored will
    # be cleaned up here:
    cache_key = cache_key_for_event(event)
    attachment_cache.delete(cache_key)
