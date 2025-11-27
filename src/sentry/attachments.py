from __future__ import annotations

__all__ = [
    "store_attachments_for_event",
    "get_attachments_for_event",
    "delete_cached_and_ratelimited_attachments",
    "CachedAttachment",
]

from typing import TYPE_CHECKING, Any

import sentry_sdk

from sentry.objectstore import get_attachments_session
from sentry.utils.json import prune_empty_keys

if TYPE_CHECKING:
    from sentry.models.project import Project


UNINITIALIZED_DATA = object()


class CachedAttachment:
    def __init__(
        self,
        name=None,
        content_type=None,
        type=None,
        data=UNINITIALIZED_DATA,
        stored_id: str | None = None,
        rate_limited=None,
        size=None,
        **kwargs,
    ):
        self.name = name
        self.content_type = content_type
        self.type = type or "event.attachment"
        assert isinstance(self.type, str), self.type
        self.rate_limited = rate_limited

        if size is not None:
            self.size = size
        elif data not in (None, UNINITIALIZED_DATA):
            self.size = len(data)
        else:
            self.size = 0

        self.stored_id = stored_id
        self._data = data

    def load_data(self, project: Project | None = None) -> bytes:
        if self.stored_id:
            assert project
            session = get_attachments_session(project.organization_id, project.id)
            return session.get(self.stored_id).payload.read()

        assert self._data is not UNINITIALIZED_DATA
        return self._data

    def meta(self) -> dict:
        return prune_empty_keys(
            {
                "name": self.name,
                "rate_limited": self.rate_limited,
                "content_type": self.content_type,
                "type": self.type,
                "size": self.size,
                "stored_id": self.stored_id,
            }
        )


@sentry_sdk.trace
def store_attachments_for_event(project: Project, event: Any, attachments: list[CachedAttachment]):
    """
    Stores the given list of `attachments` belonging to `event` for processing.

    The attachment metadata is stored within the `event`, and attachment payloads
    are stored in `objectstore`.
    """

    attachments_metadata: list[dict] = []
    for attachment in attachments:
        # if the attachment has non-empty data set, we want to store it, overwriting any existing data in case a `stored_id` is set.
        if attachment._data and attachment._data is not UNINITIALIZED_DATA:
            session = get_attachments_session(project.organization_id, project.id)
            attachment.stored_id = session.put(attachment._data, key=attachment.stored_id)

        attachments_metadata.append(attachment.meta())

    event["_attachments"] = attachments_metadata


def get_attachments_for_event(event: Any) -> list[CachedAttachment]:
    """
    Retrieves the attachments belonging to the given `event`.
    """

    return [CachedAttachment(**attachment) for attachment in event.get("_attachments", [])]


@sentry_sdk.trace
def delete_cached_and_ratelimited_attachments(
    project: Project, attachments: list[CachedAttachment]
):
    """
    This deletes all the `rate_limited` attachments from the `objectstore`.
    Non-ratelimited attachments which are already stored in `objectstore` will
    be retained there for long-term storage.
    """
    for attachment in attachments:
        # deletes from objectstore if no long-term storage is desired
        if attachment.rate_limited and attachment.stored_id:
            get_attachments_session(project.organization_id, project.id).delete(
                attachment.stored_id
            )
