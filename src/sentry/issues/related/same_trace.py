"""
Finds issues with errors in the same trace as an issue's latest event.

It reuses trace_connected_issues(), which also backs the trace section of the Similar Issues tab
(RelatedIssuesEndpoint): it looks up the issues of up to 100 error events in the trace, over the last
90 days.
"""

from collections.abc import Sequence

from sentry.issues.related.trace_connected import trace_connected_issues
from sentry.issues.related.types import (
    RelatedIssueRelation,
    RelatedIssuesContext,
    RelationType,
    RelationTypeResult,
    RelationTypeStatus,
    SameTraceMeta,
)
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.services.eventstore.models import GroupEvent
from sentry.utils.snuba import SnubaError

# What this type finds, for the API docs
SAME_TRACE_DESCRIPTION = (
    "Issues, in any project you can read, with errors in the same trace as this issue's latest "
    "event."
)
NO_TRACE_DETAIL = "This issue's event has no trace."
TRACE_SEARCH_UNAVAILABLE_DETAIL = "Trace search is temporarily unavailable. Try again later."


def same_trace_issues(ctx: RelatedIssuesContext, projects: Sequence[Project]) -> RelationTypeResult:
    """
    Issues in `projects` with errors in the same trace as the issue's latest event, most recently
    seen first. A trace can cross projects, so callers pass every project the user can read.
    """
    event = ctx.event
    if event is None:
        return _result(RelationTypeStatus.NOT_APPLICABLE, detail=NO_TRACE_DETAIL)
    if not event.trace_id:
        return _result(RelationTypeStatus.NOT_APPLICABLE, detail=NO_TRACE_DETAIL, event=event)

    try:
        group_ids, _meta = trace_connected_issues(event, list(projects))
    except SnubaError:
        return _result(
            RelationTypeStatus.UNAVAILABLE, detail=TRACE_SEARCH_UNAVAILABLE_DETAIL, event=event
        )

    # trace_connected_issues() returns the IDs in no particular order. Sort them so `limit` keeps the
    # most recently seen.
    most_recent_ids = (
        Group.objects.filter(id__in=group_ids)
        .order_by("-last_seen")
        .values_list("id", flat=True)[: ctx.limit]
    )
    return _result(
        RelationTypeStatus.OK,
        event=event,
        relations={group_id: {"type": RelationType.SAME_TRACE} for group_id in most_recent_ids},
    )


def _result(
    status: RelationTypeStatus,
    *,
    detail: str | None = None,
    event: GroupEvent | None = None,
    relations: dict[int, RelatedIssueRelation] | None = None,
) -> RelationTypeResult:
    """The result and its meta.types entry. Pass the event once the lookup has read it."""
    meta: SameTraceMeta = {"type": RelationType.SAME_TRACE, "status": status}
    if detail is not None:
        meta["detail"] = detail
    if event is not None:
        meta["eventId"] = event.event_id
        if event.trace_id:
            meta["traceId"] = event.trace_id
    return RelationTypeResult(meta, relations or {})
