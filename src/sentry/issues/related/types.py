from dataclasses import dataclass, field
from enum import StrEnum
from typing import Annotated, NotRequired, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers.models.group import BaseGroupSerializerResponse
from sentry.apidocs.descriptions import ApiDescription
from sentry.models.group import Group
from sentry.service_accounts.principal import ServiceAccountPrincipal
from sentry.services.eventstore.models import GroupEvent
from sentry.users.models.user import User


class RelationType(StrEnum):
    SIMILAR_STACKTRACE = "similar_stacktrace"
    SAME_TRACE = "same_trace"


class RelationTypeStatus(StrEnum):
    OK = "ok"
    NOT_APPLICABLE = "not_applicable"
    UNAVAILABLE = "unavailable"


@dataclass(frozen=True)
class RelatedIssuesContext:
    group: Group
    event: GroupEvent | None
    limit: int
    user: User | AnonymousUser | ServiceAccountPrincipal


class RelatedIssueRelation(TypedDict):
    type: Annotated[RelationType, ApiDescription("Why this issue is related")]
    score: NotRequired[
        Annotated[
            float,
            ApiDescription(
                "Only for similar_stacktrace. How similar the two stack traces are, from 0 to 1. "
                "Higher is more similar."
            ),
        ]
    ]


class RelatedIssue(TypedDict):
    issue: Annotated[BaseGroupSerializerResponse, ApiDescription("The related issue")]
    relations: Annotated[
        list[RelatedIssueRelation],
        ApiDescription("Why the issue is related, one entry per type that matched it"),
    ]


class RelationTypeMeta(TypedDict):
    """The fields every type's entry in meta.types has. Each type subclasses it for its own."""

    type: Annotated[RelationType, ApiDescription("The type of related issues")]
    status: Annotated[
        RelationTypeStatus,
        ApiDescription(
            "ok: the type ran, and an empty result means it found nothing. "
            "not_applicable: the type doesn't apply to this issue. "
            "unavailable: the type failed; try again later"
        ),
    ]
    detail: NotRequired[
        Annotated[
            str,
            ApiDescription("Why the type is not_applicable or unavailable"),
        ]
    ]


class SimilarStacktraceMeta(RelationTypeMeta):
    eventId: NotRequired[
        Annotated[
            str,
            ApiDescription(
                "ID of the event whose stack trace was compared: the issue's latest event. "
                "Missing when no event was read"
            ),
        ]
    ]


class SameTraceMeta(RelationTypeMeta):
    eventId: NotRequired[
        Annotated[
            str,
            ApiDescription(
                "ID of the event whose trace was searched: the issue's latest event. "
                "Missing when no event was read"
            ),
        ]
    ]
    traceId: NotRequired[
        Annotated[
            str,
            ApiDescription("The trace that was searched. Missing when the event has no trace"),
        ]
    ]


# Any type's entry in meta.types: the union of every RelationTypeMeta subclass.
AnyRelationTypeMeta = SimilarStacktraceMeta | SameTraceMeta


@dataclass(frozen=True)
class RelationTypeResult:
    # This type's entry in meta.types
    meta: AnyRelationTypeMeta
    # Group ID to relation, in the order found (dicts keep insertion order).
    relations: dict[int, RelatedIssueRelation] = field(default_factory=dict)


class RelatedIssuesMeta(TypedDict):
    types: Annotated[
        list[AnyRelationTypeMeta],
        ApiDescription("The outcome of each requested type"),
    ]


class RelatedIssuesResponse(TypedDict):
    data: Annotated[
        list[RelatedIssue],
        ApiDescription("Related issues, those matched by more types first"),
    ]
    meta: RelatedIssuesMeta
