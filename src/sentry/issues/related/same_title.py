"""
Finds error issues in the same project whose events have the same title as an issue's event (the
latest, unless the caller picks one).

Grouping splits errors by stack trace, so one cause reached from several places, or one outage
seen by several callers, becomes several issues with the same title. Stack trace similarity misses
these by design. This runs the issue stream's title filter as an issue search over the last 14 days.
"""

from datetime import timedelta

from django.utils import timezone

from sentry import search
from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.api.helpers.group_index.index import parse_and_convert_issue_search_query
from sentry.issues.grouptype import GroupCategory
from sentry.issues.related.contributing import ISSUE_SEARCH_UNAVAILABLE_DETAIL
from sentry.issues.related.types import (
    RelatedIssueRelation,
    RelatedIssuesContext,
    RelationType,
    RelationTypeResult,
    RelationTypeStatus,
    SameTitleMeta,
)
from sentry.services.eventstore.models import GroupEvent
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import SnubaError

# What this type finds, for the API docs
SAME_TITLE_DESCRIPTION = (
    "Error issues in the same project with events in the last 14 days that have the same title "
    "as this issue's event, most recently seen first."
)
ERRORS_ONLY_DETAIL = "Only error issues are matched by title."
NO_EVENT_DETAIL = "This issue has no event to read a title from."

SEARCH_RANGE = timedelta(days=14)


def same_title_issues(ctx: RelatedIssuesContext) -> RelationTypeResult:
    """Error issues in the project with the same title as `ctx.event`, most recently seen first."""
    group, event = ctx.group, ctx.event
    if group.issue_category != GroupCategory.ERROR:
        return _result(RelationTypeStatus.NOT_APPLICABLE, detail=ERRORS_ONLY_DETAIL)
    if event is None:
        return _result(RelationTypeStatus.NOT_APPLICABLE, detail=NO_EVENT_DETAIL)

    now = timezone.now()
    try:
        issues = search.backend.query(
            projects=[group.project],
            search_filters=_search_filters(ctx, event.title),
            date_from=now - SEARCH_RANGE,
            date_to=now,
            sort_by="date",
            # This issue has the title too
            limit=ctx.limit + 1,
            actor=ctx.user,
            referrer=Referrer.API_ISSUES_RELATED_ISSUES.value,
        )
    except SnubaError:
        return _result(
            RelationTypeStatus.UNAVAILABLE, detail=ISSUE_SEARCH_UNAVAILABLE_DETAIL, event=event
        )
    group_ids = [issue.id for issue in issues if issue.id != group.id][: ctx.limit]
    return _result(
        RelationTypeStatus.OK,
        event=event,
        relations={group_id: {"type": RelationType.SAME_TITLE} for group_id in group_ids},
    )


def _search_filters(ctx: RelatedIssuesContext, title: str) -> list[SearchFilter]:
    """The issue search for error issues with this title."""
    project = ctx.group.project
    category_filters = parse_and_convert_issue_search_query(
        "issue.category:error", project.organization, [project], None, ctx.user
    )
    # Built directly rather than parsed, so the title needs no escaping and * in it isn't a wildcard
    title_filter = SearchFilter(SearchKey("title"), "=", SearchValue(title, use_raw_value=True))
    return [*(f for f in category_filters if isinstance(f, SearchFilter)), title_filter]


def _result(
    status: RelationTypeStatus,
    *,
    detail: str | None = None,
    event: GroupEvent | None = None,
    relations: dict[int, RelatedIssueRelation] | None = None,
) -> RelationTypeResult:
    """The result and its meta.types entry. Pass the event once the lookup has read it."""
    meta: SameTitleMeta = {"type": RelationType.SAME_TITLE, "status": status}
    if detail is not None:
        meta["detail"] = detail
    if event is not None:
        meta["eventId"] = event.event_id
        meta["title"] = event.title
    return RelationTypeResult(meta, relations or {})
