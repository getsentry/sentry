from datetime import datetime
from typing import Any, Literal, TypedDict

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
    data: dict[str, Any]  # Event-specific keys are camelCase and IDs are strings.
    summary: str
    isUnread: bool
    dateAdded: datetime


class InboxItemResponse(TypedDict):
    id: str
    subjectType: str
    subjectId: str
    title: str | None  # Null when the subject is unavailable.
    subtitle: str  # The latest event's summary.
    eventTypes: list[str]
    eventCount: int
    unreadEventCount: int
    latestEvent: InboxItemEventResponse
    isUnread: bool
    lastActivityAt: datetime
    lastReadAt: datetime | None


class InboxUnreadCountResponse(TypedDict):
    """Number of active unread inbox items."""

    count: int
