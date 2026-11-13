"""
Finds issues whose stack traces Seer finds similar.

The Seer request is the one the Similar Issues tab sends: GroupSimilarIssuesEmbeddingsEndpoint
builds it with the same two helpers, get_seer_stacktrace() and build_seer_request(). What differs
is the handling around the request:

- Each reason the lookup can't run is reported as a status, not an empty list.
- Seer failures are reported as unavailable, not an empty list.
- Results map to group IDs without a GroupHash lookup.
"""

import logging
from collections.abc import Sequence

from sentry.auth.principal import acting_user_id
from sentry.grouping.grouping_info import get_grouping_info_from_variants_legacy
from sentry.issues.grouptype import GroupCategory
from sentry.issues.related.types import (
    RelatedIssueRelation,
    RelatedIssuesContext,
    RelationType,
    RelationTypeResult,
    RelationTypeStatus,
    SimilarStacktraceMeta,
)
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.seer.similarity.config import get_grouping_model_version, should_skip_seer_fallback
from sentry.seer.similarity.similar_issues import get_similarity_data_from_seer
from sentry.seer.similarity.types import (
    GroupingVersion,
    SeerSimilarIssueData,
    SimilarIssuesEmbeddingsRequest,
)
from sentry.seer.similarity.utils import (
    ReferrerOptions,
    event_content_has_stacktrace,
    get_stacktrace_string,
    killswitch_enabled,
    project_uses_seer_similarity,
    stacktrace_exceeds_limits,
)
from sentry.services.eventstore.models import GroupEvent
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)

# What this type finds, for the API docs
SIMILAR_STACKTRACE_DESCRIPTION = (
    "Issues in the same project whose stack traces Seer finds similar to this issue's latest "
    "event. Only error issues have them."
)
SIMILARITY_UNAVAILABLE_DETAIL = "Similar stack traces are temporarily unavailable. Try again later."
NOT_AN_ERROR_DETAIL = "Only error issues have similar stack traces."
SIMILARITY_DISABLED_DETAIL = "Seer similarity isn't enabled for this project."
NO_STACKTRACE_DETAIL = "This issue's event has no stack trace Seer can compare."


# Shared with GroupSimilarIssuesEmbeddingsEndpoint


def get_seer_stacktrace(event: GroupEvent, model_version: GroupingVersion) -> str:
    """The event's stack trace as Seer reads it, or "" when there's none Seer can use."""
    if not event_content_has_stacktrace(event):
        return ""
    variants = event.get_grouping_variants(normalize_stacktraces=True)
    if stacktrace_exceeds_limits(
        event, variants, ReferrerOptions.SIMILAR_ISSUES_TAB, model_version
    ):
        return ""
    try:
        return get_stacktrace_string(get_grouping_info_from_variants_legacy(variants))
    except Exception:
        logger.exception("Unexpected exception in stacktrace string formatting")
        return ""


def build_seer_request(
    event: GroupEvent, project: Project, stacktrace: str, model_version: GroupingVersion
) -> SimilarIssuesEmbeddingsRequest:
    """A read-only request for issues similar to the event. Callers add `k` if they need it."""
    return {
        "event_id": event.event_id,
        "hash": event.get_primary_hash(),
        "project_id": project.id,
        "stacktrace": stacktrace,
        "exception_type": get_path(event.data, "exception", "values", -1, "type"),
        "read_only": True,
        # Seer's metrics for the Similar Issues tab are tagged with this referrer
        "referrer": "similar_issues",
        "model": model_version,
        "training_mode": False,
        "platform": event.platform or "unknown",
        "skip_fallback": should_skip_seer_fallback(project),
    }


# The similar_stacktrace type of the related issues endpoint


def similar_stacktrace_issues(ctx: RelatedIssuesContext) -> RelationTypeResult:
    """Issues in the same project whose stack traces Seer finds similar, most similar first."""
    group, event = ctx.group, ctx.event

    # 1. Check that this type applies to the issue
    # Seer only indexes error issues, so a metric or performance issue has nothing to compare.
    if group.issue_category != GroupCategory.ERROR:
        return _result(RelationTypeStatus.NOT_APPLICABLE, detail=NOT_AN_ERROR_DETAIL)
    if not project_uses_seer_similarity(group.project):
        return _result(RelationTypeStatus.NOT_APPLICABLE, detail=SIMILARITY_DISABLED_DETAIL)
    if killswitch_enabled(group.project.id, ReferrerOptions.SIMILAR_ISSUES_TAB):
        return _result(RelationTypeStatus.UNAVAILABLE, detail=SIMILARITY_UNAVAILABLE_DETAIL)
    if event is None:
        return _result(RelationTypeStatus.NOT_APPLICABLE, detail=NO_STACKTRACE_DETAIL)
    model_version = get_grouping_model_version(group.project)
    stacktrace = get_seer_stacktrace(event, model_version)
    if not stacktrace:
        return _result(RelationTypeStatus.NOT_APPLICABLE, detail=NO_STACKTRACE_DETAIL, event=event)

    # 2. Ask Seer
    request = build_seer_request(event, group.project, stacktrace, model_version)
    request["k"] = ctx.limit
    viewer_context = SeerViewerContext(
        organization_id=group.project.organization_id, user_id=acting_user_id(ctx.user)
    )
    try:
        results, _model_used = get_similarity_data_from_seer(
            request, raise_on_error=True, viewer_context=viewer_context
        )
    except Exception:
        # get_similarity_data_from_seer already logs and records a metric for each failure
        return _result(
            RelationTypeStatus.UNAVAILABLE, detail=SIMILARITY_UNAVAILABLE_DETAIL, event=event
        )

    # 3. Turn Seer's results into relations
    return _result(RelationTypeStatus.OK, event=event, relations=_to_relations(results, group))


def _result(
    status: RelationTypeStatus,
    *,
    detail: str | None = None,
    event: GroupEvent | None = None,
    relations: dict[int, RelatedIssueRelation] | None = None,
) -> RelationTypeResult:
    """The result and its meta.types entry. Pass the event once the lookup has read it."""
    meta: SimilarStacktraceMeta = {"type": RelationType.SIMILAR_STACKTRACE, "status": status}
    if detail is not None:
        meta["detail"] = detail
    if event is not None:
        meta["eventId"] = event.event_id
    return RelationTypeResult(meta, relations or {})


def _to_relations(
    results: Sequence[SeerSimilarIssueData], group: Group
) -> dict[int, RelatedIssueRelation]:
    """
    One relation per similar group, leaving out the issue itself.

    Seer sorts results by ascending distance, so the first result for each group has its best
    score. Each result already carries its group ID, so no GroupHash lookup is needed.
    """
    relations: dict[int, RelatedIssueRelation] = {}
    for result in results:
        if result.parent_group_id == group.id or result.parent_group_id in relations:
            continue
        relations[result.parent_group_id] = {
            "type": RelationType.SIMILAR_STACKTRACE,
            "score": round(1 - result.stacktrace_distance, 4),
        }
    return relations
