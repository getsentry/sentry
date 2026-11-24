"""
Finds the Seer investigations that linked an issue.

When an agentic investigation finishes, Seer names the issues its evidence points to, and Sentry
records a link in each one's action log. An investigation doesn't link the issue it started from.
"""

from sentry.auth.access import Access
from sentry.issues.action_log.types import GroupActionType
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.issues.related.types import (
    InvestigationsMeta,
    RelatedInvestigation,
    RelatedIssuesContext,
    RelationType,
    RelationTypeResult,
    RelationTypeStatus,
)
from sentry.notebooks.access import can_view_issue_links
from sentry.notebooks.models import Notebook, NotebookStatus

# What this type finds, for the API docs
INVESTIGATIONS_DESCRIPTION = (
    "Seer investigations that linked this issue. When an investigation finishes, it links the "
    "issues its evidence points to. These are returned in investigations, not data."
)
NO_INVESTIGATION_ACCESS_DETAIL = (
    "Investigations that link issues aren't enabled for this organization, or you can't view "
    "investigations."
)


def linked_investigations(ctx: RelatedIssuesContext, access: Access) -> RelationTypeResult:
    """
    The investigations that linked this issue, most recently linked first. Deleted investigations
    drop out, so this can return fewer than the limit.
    """
    organization = ctx.group.project.organization
    if not can_view_issue_links(organization, ctx.user, access):
        return _result(RelationTypeStatus.NOT_APPLICABLE, detail=NO_INVESTIGATION_ACCESS_DETAIL)

    links = list(
        GroupActionLogEntry.objects.filter(
            group_id=ctx.group.id, type=GroupActionType.INVESTIGATION_LINKED
        ).order_by("-date_added", "-id")[: ctx.limit]
    )
    # Deleting an investigation archives it
    notebooks = Notebook.objects.filter(
        organization_id=organization.id, status=NotebookStatus.ACTIVE
    ).in_bulk([link.data["notebook_id"] for link in links])

    investigations: list[RelatedInvestigation] = [
        {
            "investigation": {"id": str(notebook.id), "title": notebook.title},
            "hypothesisStatement": link.data["hypothesis_statement"],
            "reason": link.data.get("reason"),
        }
        for link in links
        if (notebook := notebooks.get(link.data["notebook_id"])) is not None
    ]
    return _result(RelationTypeStatus.OK, investigations=investigations)


def _result(
    status: RelationTypeStatus,
    *,
    detail: str | None = None,
    investigations: list[RelatedInvestigation] | None = None,
) -> RelationTypeResult:
    meta: InvestigationsMeta = {"type": RelationType.INVESTIGATIONS, "status": status}
    if detail is not None:
        meta["detail"] = detail
    return RelationTypeResult(meta, investigations=investigations or [])
