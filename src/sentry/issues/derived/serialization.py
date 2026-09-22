"""
API serialization for derived issue data.

Reads the materialized ``GroupDerivedData`` for a set of groups and produces the
camelCase response shape consumed by the group serializer. Read-only: this never
triggers pipeline processing, so callers see whatever the last processing pass
materialized (possibly stale), mirroring every other derived-data consumer.
"""

from datetime import datetime
from typing import TypedDict

from sentry.issues.derived.features import (
    BLOCKER,
    HAS_OPEN_FIX_PR,
    HAS_ROOT_CAUSE,
    IS_ASSIGNED,
    LAST_COMPLETED_AUTOFIX_STEP,
    LAST_PROGRESSED_AT,
    PROGRESS,
    STATUS,
    VIEW_COUNT,
)
from sentry.issues.derived.framework import DerivedDataError
from sentry.issues.derived.processing import PIPELINE
from sentry.issues.derived.reporting import report_derived_data_error
from sentry.issues.derived.store import GroupDerivedDataStore
from sentry.issues.models.groupderiveddata import GroupDerivedData
from sentry.issues.progress_state import IssueProgressState
from sentry.utils import metrics


class GroupDerivedDataResponse(TypedDict):
    blocker: str
    progress: str
    status: str
    viewCount: int
    hasOpenFixPr: bool
    isAssigned: bool
    hasRootCause: bool
    lastCompletedAutofixStep: str
    lastProgressedAt: datetime | None


def get_bulk_group_derived_data(group_ids: set[int]) -> dict[int, GroupDerivedDataResponse]:
    """Bulk-load derived action log data for a set of groups, keyed by group id."""
    if not group_ids:
        return {}

    result: dict[int, GroupDerivedDataResponse] = {}
    served_by_status = {"fresh": 0, "stale_hash": 0, "invalidated": 0}
    for derived in GroupDerivedData.objects.filter(group_id__in=group_ids):
        if derived.pipeline_hash is None:
            served_by_status["invalidated"] += 1
        elif derived.pipeline_hash == PIPELINE.pipeline_hash:
            served_by_status["fresh"] += 1
        else:
            served_by_status["stale_hash"] += 1

        try:
            state = GroupDerivedDataStore.load(PIPELINE, derived)
            progress = state[PROGRESS]
            result[derived.group_id] = GroupDerivedDataResponse(
                blocker=state[BLOCKER].value,
                progress=(progress or IssueProgressState.FIX_APPLIED).value,
                status=state[STATUS].value,
                viewCount=state[VIEW_COUNT],
                hasOpenFixPr=state[HAS_OPEN_FIX_PR],
                isAssigned=state[IS_ASSIGNED],
                hasRootCause=state[HAS_ROOT_CAUSE],
                lastCompletedAutofixStep=state[LAST_COMPLETED_AUTOFIX_STEP].value,
                lastProgressedAt=state[LAST_PROGRESSED_AT],
            )
        except DerivedDataError as error:
            report_derived_data_error(
                error, derived=derived, operation="serialize", pipeline_hash=PIPELINE.pipeline_hash
            )

    for status, count in served_by_status.items():
        if count:
            metrics.incr(
                "issues.derived.served",
                amount=count,
                sample_rate=1.0,
                tags={"status": status},
            )

    return result
