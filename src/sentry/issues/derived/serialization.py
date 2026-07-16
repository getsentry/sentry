"""
API serialization for derived issue data.

Reads the materialized ``GroupDerivedData`` for a set of groups and produces the
camelCase response shape consumed by the group serializer. Read-only: this never
triggers pipeline processing, so callers see whatever the last processing pass
materialized (possibly stale), mirroring every other derived-data consumer.
"""

import logging
from datetime import datetime
from typing import TypedDict

from sentry.issues.derived.features import (
    HAS_OPEN_FIX_PR,
    HAS_ROOT_CAUSE,
    IS_ASSIGNED,
    LAST_PROGRESSED_AT,
    PROGRESS,
    STATUS,
    VIEW_COUNT,
)
from sentry.issues.derived.processing import PIPELINE
from sentry.issues.derived.store import GroupDerivedDataStore
from sentry.issues.models.groupderiveddata import GroupDerivedData
from sentry.issues.progress_state import IssueProgressState

logger = logging.getLogger(__name__)


class GroupDerivedDataResponse(TypedDict):
    progress: str
    status: str
    viewCount: int
    hasOpenFixPr: bool
    isAssigned: bool
    hasRootCause: bool
    lastProgressedAt: datetime | None


def get_bulk_group_derived_data(group_ids: set[int]) -> dict[int, GroupDerivedDataResponse]:
    """Bulk-load derived action log data for a set of groups, keyed by group id."""
    if not group_ids:
        return {}

    result: dict[int, GroupDerivedDataResponse] = {}
    for derived in GroupDerivedData.objects.filter(group_id__in=group_ids):
        try:
            state = GroupDerivedDataStore.load(PIPELINE, derived)
            progress = state[PROGRESS]
            result[derived.group_id] = GroupDerivedDataResponse(
                progress=(progress or IssueProgressState.FIX_APPLIED).value,
                status=state[STATUS].value,
                viewCount=state[VIEW_COUNT],
                hasOpenFixPr=state[HAS_OPEN_FIX_PR],
                isAssigned=state[IS_ASSIGNED],
                hasRootCause=state[HAS_ROOT_CAUSE],
                lastProgressedAt=state[LAST_PROGRESSED_AT],
            )
        except (TypeError, ValueError):
            logger.exception(
                "Failed to serialize group derived data",
                extra={"group_id": derived.group_id},
            )
    return result
