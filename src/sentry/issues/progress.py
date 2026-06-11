from __future__ import annotations

from collections.abc import Sequence
from enum import StrEnum

from django.db.models import Max, Q

from sentry.models.activity import Activity
from sentry.models.groupassignee import GroupAssignee
from sentry.types.activity import ActivityType


class IssueProgressState(StrEnum):
    IDENTIFIED = "identified"
    TRIAGED = "triaged"
    DIAGNOSED = "diagnosed"
    FIX_PROPOSED = "fix_proposed"
    FIX_APPLIED = "fix_applied"


ISSUE_PROGRESS_TO_ACTIVITY_TYPES: dict[IssueProgressState, list[int]] = {
    IssueProgressState.DIAGNOSED: [ActivityType.SEER_RCA_COMPLETED.value],
    IssueProgressState.FIX_PROPOSED: [
        ActivityType.SEER_PR_CREATED.value,
        ActivityType.SET_RESOLVED_IN_PULL_REQUEST.value,
        ActivityType.REFERENCED_IN_COMMIT.value,
    ],
    IssueProgressState.FIX_APPLIED: [
        ActivityType.SET_RESOLVED_IN_COMMIT.value,
        ActivityType.SET_RESOLVED_IN_RELEASE.value,
        ActivityType.SET_RESOLVED_BY_AGE.value,
        ActivityType.SET_RESOLVED.value,
    ],
}

# Defines the order in which progress states are considered
# Triaged and Identified are fallbacks (depending on assignment status) so are not listed here.
PROGRESS_STATES_DESCENDING = [
    IssueProgressState.FIX_APPLIED,
    IssueProgressState.FIX_PROPOSED,
    IssueProgressState.DIAGNOSED,
]


def get_group_progress_states(
    group_ids: Sequence[int],
) -> dict[int, str]:
    """
    XXX(malwilley): This is a temporary function to derive progress from Activity records.
    It will be replaced by a derived property on the group action log when available.
    """

    if not group_ids:
        return {}

    assigned_group_ids = set[int](
        GroupAssignee.objects.filter(group_id__in=group_ids).values_list("group_id", flat=True)
    )

    all_progress_activity_types = [
        t for types in ISSUE_PROGRESS_TO_ACTIVITY_TYPES.values() for t in types
    ]

    rows = (
        Activity.objects.filter(
            group_id__in=group_ids,
            type__in=set(all_progress_activity_types) | {ActivityType.SET_REGRESSION.value},
        )
        .values("group_id")
        .annotate(
            latest_regression=Max(
                "datetime",
                filter=Q(type=ActivityType.SET_REGRESSION.value),
            ),
            latest_diagnosed=Max(
                "datetime",
                filter=Q(type__in=ISSUE_PROGRESS_TO_ACTIVITY_TYPES[IssueProgressState.DIAGNOSED]),
            ),
            latest_fix_proposed=Max(
                "datetime",
                filter=Q(
                    type__in=ISSUE_PROGRESS_TO_ACTIVITY_TYPES[IssueProgressState.FIX_PROPOSED]
                ),
            ),
            latest_fix_applied=Max(
                "datetime",
                filter=Q(type__in=ISSUE_PROGRESS_TO_ACTIVITY_TYPES[IssueProgressState.FIX_APPLIED]),
            ),
        )
    )

    annotation_key_by_state = {
        IssueProgressState.FIX_APPLIED: "latest_fix_applied",
        IssueProgressState.FIX_PROPOSED: "latest_fix_proposed",
        IssueProgressState.DIAGNOSED: "latest_diagnosed",
    }

    result: dict[int, str] = {}
    groups_with_activities = set()

    for row in rows:
        group_id = row["group_id"]
        groups_with_activities.add(group_id)
        latest_regression = row["latest_regression"]

        # Find the first matching progress progress state which occurred more recently than the latest regression
        for state in PROGRESS_STATES_DESCENDING:
            latest = row[annotation_key_by_state[state]]
            if latest is not None and (latest_regression is None or latest >= latest_regression):
                result[group_id] = state.value
                break
        # If the regression was most recent
        else:
            result[group_id] = (
                IssueProgressState.TRIAGED
                if group_id in assigned_group_ids
                else IssueProgressState.IDENTIFIED
            ).value

    # If the group does not have any matching activities, it is presumed to be identified or triaged.
    for group_id in group_ids:
        if group_id not in groups_with_activities:
            result[group_id] = (
                IssueProgressState.TRIAGED
                if group_id in assigned_group_ids
                else IssueProgressState.IDENTIFIED
            ).value

    return result
