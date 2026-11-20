from datetime import datetime
from typing import Annotated, Literal, TypedDict

from sentry.apidocs.descriptions import ApiDescription
from sentry.inbox.event_data import InboxEventDataResponse
from sentry.users.api.serializers.user import SerializedAvatarFields


class InboxUserActorResponse(TypedDict):
    type: Annotated[Literal["user"], ApiDescription("The actor type")]
    id: Annotated[str, ApiDescription("The user's ID")]
    name: Annotated[str, ApiDescription("The user's display name")]
    avatar: Annotated[SerializedAvatarFields | None, ApiDescription("The user's avatar")]


class InboxSystemActorResponse(TypedDict):
    type: Annotated[Literal["system"], ApiDescription("The actor type")]
    id: Annotated[None, ApiDescription("The actor's ID")]
    name: Annotated[Literal["Sentry"], ApiDescription("The system actor's display name")]
    avatar: Annotated[None, ApiDescription("The actor's avatar")]


InboxActorResponse = InboxUserActorResponse | InboxSystemActorResponse


class InboxItemEventResponse(TypedDict):
    id: Annotated[str, ApiDescription("The inbox event ID")]
    type: Annotated[str, ApiDescription("The event type")]
    actor: Annotated[InboxActorResponse, ApiDescription("The user or system that caused the event")]
    data: Annotated[
        InboxEventDataResponse,
        ApiDescription("Metadata for the event type"),
    ]
    summary: Annotated[str, ApiDescription("A summary of the activity")]
    isUnread: Annotated[
        bool, ApiDescription("Whether the event occurred after the item was last read")
    ]
    dateAdded: Annotated[datetime, ApiDescription("When the event was recorded")]


class InboxSubjectProjectResponse(TypedDict):
    id: Annotated[str, ApiDescription("The project ID")]
    slug: Annotated[str, ApiDescription("The project slug")]


class InboxIssueSubjectMetadataResponse(TypedDict):
    shortId: Annotated[str, ApiDescription("The issue's short ID, such as PROJECT-1A")]
    project: Annotated[InboxSubjectProjectResponse, ApiDescription("The issue's project")]


class InboxEmptySubjectMetadataResponse(TypedDict):
    """An empty metadata object."""


class InboxIssueSubjectResponse(TypedDict):
    id: Annotated[str, ApiDescription("The issue ID")]
    type: Annotated[Literal["issue"], ApiDescription("The subject type")]
    title: Annotated[str, ApiDescription("The issue's current title")]
    metadata: Annotated[
        InboxIssueSubjectMetadataResponse, ApiDescription("Issue-specific subject details")
    ]


class InboxNotebookSubjectResponse(TypedDict):
    id: Annotated[str, ApiDescription("The notebook (investigation) ID")]
    type: Annotated[Literal["notebook"], ApiDescription("The subject type")]
    title: Annotated[str, ApiDescription("The notebook's current title")]
    metadata: Annotated[
        InboxEmptySubjectMetadataResponse, ApiDescription("Notebook-specific subject details")
    ]


InboxSubjectResponse = InboxIssueSubjectResponse | InboxNotebookSubjectResponse


class InboxItemResponse(TypedDict):
    id: Annotated[str, ApiDescription("The inbox item ID")]
    subject: Annotated[
        InboxSubjectResponse,
        ApiDescription("The issue or notebook (investigation) the item is about"),
    ]
    url: Annotated[str, ApiDescription("A link to the item's latest activity")]
    subtitle: Annotated[str, ApiDescription("The latest event's summary")]
    eventTypes: Annotated[list[str], ApiDescription("The distinct event types for the item")]
    eventCount: Annotated[
        int, ApiDescription("The number of events currently available for the item")
    ]
    unreadEventCount: Annotated[
        int, ApiDescription("The number of unread events currently available for the item")
    ]
    latestEvent: Annotated[InboxItemEventResponse, ApiDescription("The most recent event")]
    isUnread: Annotated[bool, ApiDescription("Whether the item has unread activity")]
    lastActivityAt: Annotated[datetime, ApiDescription("When the item's latest activity occurred")]
    lastReadAt: Annotated[
        datetime | None, ApiDescription("When the item was last marked read, or null")
    ]


class InboxCountResponse(TypedDict):
    """Number of active inbox items matching the filters."""

    count: Annotated[int, ApiDescription("The number of inbox items matching the filters")]


class InboxUpdateResponse(TypedDict):
    """Number of inbox items matching a bulk update, including unchanged items."""

    updatedCount: Annotated[
        int,
        ApiDescription(
            "The number of matching items, including items already in the requested state"
        ),
    ]
