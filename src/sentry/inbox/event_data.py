from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Mapping
from dataclasses import dataclass, fields
from typing import Annotated, Self, TypedDict

from sentry.apidocs.descriptions import ApiDescription


class IssueAssignedDataResponse(TypedDict):
    assignmentSource: Annotated[
        str | None,
        ApiDescription("The source of the issue assignment, if available"),
    ]
    activityId: Annotated[str, ApiDescription("The issue activity ID")]


class IssueMentionedDataResponse(TypedDict):
    commentId: Annotated[str, ApiDescription("The comment ID")]


class IssuePRReadyForReviewDataResponse(TypedDict):
    prUrl: Annotated[str, ApiDescription("The pull request URL")]
    seerRunId: Annotated[str, ApiDescription("The Seer run ID")]


class NotebookCompletedDataResponse(TypedDict):
    seerRunId: Annotated[str, ApiDescription("The Seer run ID")]
    generation: Annotated[
        int, ApiDescription("The investigation generation completed by the Seer run")
    ]


class NotebookMentionedDataResponse(TypedDict):
    commentId: Annotated[str, ApiDescription("The comment ID")]
    blockId: Annotated[
        str | None, ApiDescription("The notebook block ID, or null for a comment on the notebook")
    ]


class NotebookParticipantAddedDataResponse(TypedDict):
    pass


InboxEventDataResponse = (
    IssueAssignedDataResponse
    | IssueMentionedDataResponse
    | IssuePRReadyForReviewDataResponse
    | NotebookCompletedDataResponse
    | NotebookMentionedDataResponse
    | NotebookParticipantAddedDataResponse
)


@dataclass(frozen=True, kw_only=True)
class InboxEventData(ABC):
    """Event payload, stored as JSON on each recorded event.

    Give fields added to existing payloads a default so retained events can still be rebuilt.
    """

    @classmethod
    def from_payload(cls, payload: Mapping[str, object]) -> Self:
        """Parse trusted recorded data, applying defaults and ignoring unknown keys.

        Required fields must have been written by the producer. Missing fields indicate broken
        recorded data; this does not validate field values or impose new recording rules.
        """
        names = {field.name for field in fields(cls) if field.init}
        return cls(**{key: value for key, value in payload.items() if key in names})

    @abstractmethod
    def serialize(self) -> InboxEventDataResponse:
        """Return the API representation, with string IDs and camelCase keys."""

    def get_url(self, subject_url: str) -> str:
        """Override to link to something on the subject's page, such as a comment."""
        return subject_url
