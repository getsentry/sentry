"""
Finds the other issues in an issue's supergroup.

Seer puts each new error issue with a stack trace in a supergroup: it writes a one-line root cause
for one of the issue's events and groups issues whose root causes describe the same failure, in any
project of the organization. An issue is in at most one supergroup.
"""

from collections.abc import Sequence

from urllib3.exceptions import MaxRetryError
from urllib3.exceptions import TimeoutError as Urllib3TimeoutError

from sentry import features
from sentry.auth.principal import acting_user_id
from sentry.issues.grouptype import GroupCategory
from sentry.issues.related.types import (
    RelatedIssueRelation,
    RelatedIssuesContext,
    RelatedSupergroup,
    RelationType,
    RelationTypeResult,
    RelationTypeStatus,
    SameSupergroupMeta,
)
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.seer.models import SeerApiError
from sentry.seer.supergroups.by_group import get_supergroups_by_group_ids

# What this type finds, for the API docs
SAME_SUPERGROUP_DESCRIPTION = (
    "Issues, in any project you can read, in the same supergroup as this issue: Seer groups error "
    "issues whose root causes describe the same failure, wherever it was called from."
)
NOT_ENABLED_DETAIL = "Supergroups aren't enabled for this organization."
NON_ERROR_ISSUE_DETAIL = "Only error issues are in supergroups."
NOT_IN_A_SUPERGROUP_DETAIL = (
    "This issue isn't in a supergroup. Seer adds new error issues with a stack trace a few "
    "seconds after they're created."
)
SUPERGROUPS_UNAVAILABLE_DETAIL = "Supergroups are temporarily unavailable. Try again later."

# Seconds. Types run one after another, so keep this short, like Seer similarity's timeout.
SEER_TIMEOUT = 1


def same_supergroup_issues(
    ctx: RelatedIssuesContext, projects: Sequence[Project]
) -> RelationTypeResult:
    """
    The other issues in this issue's supergroup that are in `projects`, most recently seen first. A
    supergroup can cross projects, so callers pass every project the user can read.
    """
    group = ctx.group
    organization = group.project.organization
    if not (
        features.has("organizations:related-issues-supergroups", organization, actor=ctx.user)
        # Without it, Seer doesn't build supergroups for the organization's issues
        and features.has("organizations:supergroups-lightweight-rca-clustering-write", organization)
    ):
        return _result(RelationTypeStatus.NOT_APPLICABLE, detail=NOT_ENABLED_DETAIL)
    if group.issue_category != GroupCategory.ERROR:
        return _result(RelationTypeStatus.NOT_APPLICABLE, detail=NON_ERROR_ISSUE_DETAIL)

    try:
        response = get_supergroups_by_group_ids(
            organization, [group.id], user_id=acting_user_id(ctx.user), timeout=SEER_TIMEOUT
        )
    except (SeerApiError, Urllib3TimeoutError, MaxRetryError):
        return _result(RelationTypeStatus.UNAVAILABLE, detail=SUPERGROUPS_UNAVAILABLE_DETAIL)
    if not response["data"]:
        return _result(RelationTypeStatus.NOT_APPLICABLE, detail=NOT_IN_A_SUPERGROUP_DETAIL)
    [supergroup] = response["data"]

    # Seer returns every issue in the supergroup, including ones in projects the caller can't read
    group_ids = (
        Group.objects.filter(
            id__in=supergroup["group_ids"], project_id__in=[project.id for project in projects]
        )
        .exclude(id=group.id)
        .order_by("-last_seen")
        .values_list("id", flat=True)[: ctx.limit]
    )
    return _result(
        RelationTypeStatus.OK,
        supergroup={"id": str(supergroup["id"]), "title": supergroup["title"]},
        relations={group_id: {"type": RelationType.SAME_SUPERGROUP} for group_id in group_ids},
    )


def _result(
    status: RelationTypeStatus,
    *,
    detail: str | None = None,
    supergroup: RelatedSupergroup | None = None,
    relations: dict[int, RelatedIssueRelation] | None = None,
) -> RelationTypeResult:
    meta: SameSupergroupMeta = {"type": RelationType.SAME_SUPERGROUP, "status": status}
    if detail is not None:
        meta["detail"] = detail
    if supergroup is not None:
        meta["supergroup"] = supergroup
    return RelationTypeResult(meta, relations or {})
