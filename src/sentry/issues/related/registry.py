"""
The relation types of the related issues endpoint, in the order they appear in its response.

To add a type:
1. Add its value to `RelationType`, and a `RelationTypeMeta` subclass for its meta.types entry to
   `AnyRelationTypeMeta` (types.py).
2. Write its module: a function that takes a `RelatedIssuesContext` and returns a
   `RelationTypeResult`, reporting each reason it can't run as a status.
3. Add a `RelationTypeDefinition` to `RELATION_TYPES`.
"""

from collections.abc import Callable
from dataclasses import dataclass

from sentry.incidents.grouptype import MetricIssue
from sentry.issues.grouptype import GroupCategory
from sentry.issues.related.contributing import (
    CONTRIBUTING_DESCRIPTION,
    NOT_A_METRIC_ISSUE_DETAIL,
    contributing_issues,
)
from sentry.issues.related.same_supergroup import (
    NON_ERROR_ISSUE_DETAIL,
    SAME_SUPERGROUP_DESCRIPTION,
    same_supergroup_issues,
)
from sentry.issues.related.same_title import (
    ERRORS_ONLY_DETAIL,
    SAME_TITLE_DESCRIPTION,
    same_title_issues,
)
from sentry.issues.related.same_trace import SAME_TRACE_DESCRIPTION, same_trace_issues
from sentry.issues.related.similar_stacktrace import (
    NOT_AN_ERROR_DETAIL,
    SIMILAR_STACKTRACE_DESCRIPTION,
    similar_stacktrace_issues,
)
from sentry.issues.related.types import (
    RelatedIssuesContext,
    RelationType,
    RelationTypeResult,
    RelationTypeStatus,
)
from sentry.models.group import Group


@dataclass(frozen=True)
class AppliesTo:
    """Which issues a type applies to, and why it doesn't apply to the others."""

    check: Callable[[Group], bool]
    # Reported as the not_applicable detail for the issues it doesn't apply to
    detail: str


@dataclass(frozen=True)
class RelationTypeDefinition:
    type: RelationType
    # What it finds, for the API docs
    description: str
    # None when the type applies to every issue
    applies_to: AppliesTo | None
    find: Callable[[RelatedIssuesContext], RelationTypeResult]


def is_error_issue(group: Group) -> bool:
    return group.issue_category == GroupCategory.ERROR


def is_metric_issue(group: Group) -> bool:
    return group.type == MetricIssue.type_id


RELATION_TYPES = [
    RelationTypeDefinition(
        type=RelationType.SIMILAR_STACKTRACE,
        description=SIMILAR_STACKTRACE_DESCRIPTION,
        # Seer only indexes error issues, so a metric or performance issue has nothing to compare
        applies_to=AppliesTo(is_error_issue, NOT_AN_ERROR_DETAIL),
        find=similar_stacktrace_issues,
    ),
    RelationTypeDefinition(
        type=RelationType.SAME_TRACE,
        description=SAME_TRACE_DESCRIPTION,
        applies_to=None,
        find=same_trace_issues,
    ),
    RelationTypeDefinition(
        type=RelationType.CONTRIBUTING,
        description=CONTRIBUTING_DESCRIPTION,
        applies_to=AppliesTo(is_metric_issue, NOT_A_METRIC_ISSUE_DETAIL),
        find=contributing_issues,
    ),
    RelationTypeDefinition(
        type=RelationType.SAME_TITLE,
        description=SAME_TITLE_DESCRIPTION,
        # Other issues' titles are per detector, so a match finds every issue the detector made
        applies_to=AppliesTo(is_error_issue, ERRORS_ONLY_DETAIL),
        find=same_title_issues,
    ),
    RelationTypeDefinition(
        type=RelationType.SAME_SUPERGROUP,
        description=SAME_SUPERGROUP_DESCRIPTION,
        # Seer only puts error issues in supergroups
        applies_to=AppliesTo(is_error_issue, NON_ERROR_ISSUE_DETAIL),
        find=same_supergroup_issues,
    ),
]


def find_related_issues(
    definition: RelationTypeDefinition, ctx: RelatedIssuesContext
) -> RelationTypeResult:
    """Runs one type, or reports that it doesn't apply to the issue without running it."""
    if definition.applies_to is not None and not definition.applies_to.check(ctx.group):
        return RelationTypeResult(
            {
                "type": definition.type,
                "status": RelationTypeStatus.NOT_APPLICABLE,
                "detail": definition.applies_to.detail,
            }
        )
    return definition.find(ctx)
