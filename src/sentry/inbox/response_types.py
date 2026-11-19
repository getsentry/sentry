from collections.abc import Mapping
from datetime import datetime
from typing import Literal, TypedDict

from sentry.users.api.serializers.user import SerializedAvatarFields


class InboxUserActorResponse(TypedDict):
    type: Literal["user"]
    id: str
    name: str
    avatar: SerializedAvatarFields | None


class InboxSystemActorResponse(TypedDict):
    type: Literal["system"]
    id: None
    name: Literal["Sentry"]
    avatar: None


InboxActorResponse = InboxUserActorResponse | InboxSystemActorResponse


class InboxItemEventResponse(TypedDict):
    id: str
    type: str
    actor: InboxActorResponse
    data: Mapping[str, object]
    summary: str
    isUnread: bool
    dateAdded: datetime


class InboxItemResponse(TypedDict):
    id: str
    subjectType: str
    subjectId: str
    title: str | None  # Null when the subject is unavailable.
    url: str  # Latest event's URL, falling back to the subject's inbox URL.
    subtitle: str  # The latest event's summary.
    eventTypes: list[str]
    eventCount: int
    unreadEventCount: int
    latestEvent: InboxItemEventResponse
    isUnread: bool
    lastActivityAt: datetime
    lastReadAt: datetime | None


class InboxCountResponse(TypedDict):
    """Number of active inbox items matching the filters."""

    count: int


class InboxUpdateResponse(TypedDict):
    """Number of inbox items matching a bulk update, including unchanged items."""

    updatedCount: int
