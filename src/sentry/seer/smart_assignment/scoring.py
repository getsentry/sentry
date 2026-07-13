"""Capture ground truth for a prediction and score it.

This is the evaluation side of the feature: `record_ground_truth` labels a result
row with who the issue actually belonged to, and `score_prediction` grades the
prediction against that label. Both the trigger path (on assignment/resolution)
and the delivery handler (when Seer's answer lands) drive these.

Correctness can't be scored at delivery: the ground-truth assignee usually lands
later (and occasionally earlier, if someone assigns before Seer finishes). So both
`record_ground_truth` and the delivery handler call `score_prediction` after they
write, and whichever completes the (prediction, ground truth) pair second emits
the metric. The chosen outcome is also stored on the row (in `extras`), which
doubles as a one-shot marker so we emit exactly once.

Outcomes give partial credit for landing on the right team:
  - `exact` -- predicted user is the actual assignee
  - `team`  -- predicted user isn't the assignee but is on the correct team
  - `miss`  -- neither

The "correct team" is the team the issue was assigned to, or (for a user
assignment) any team the actual assignee belongs to. This is a coarse live signal;
authoritative accuracy is best computed offline from the table.
"""

from __future__ import annotations

from django.utils import timezone

from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.seer.models.smart_assignment import SeerSmartAssignmentResult, SmartAssignmentTrigger
from sentry.utils import metrics

_SCORE_KEY = "score"

# Marker the acting code stamps into the ASSIGNED activity's data (via the assign()
# `extra` dict) when it auto-assigns based on a prediction. Lets ground-truth
# capture skip our own assignment -- recording it would just score us against
# ourselves.
AUTO_ASSIGN_SOURCE = "seer_smart_assignment"


def record_ground_truth(
    group: Group,
    trigger: SmartAssignmentTrigger,
    activity: Activity | None = None,
) -> None:
    """Annotate an existing prediction row with ground truth for the given outcome.

    No-op if no prediction was made for the group, or the outcome carries no useful
    signal: `PR_CREATED`, an automatic resolution with no acting user, or our own
    auto-assignment (tagged with `AUTO_ASSIGN_SOURCE`, which would just score us
    against ourselves). For an assignment we mirror the current assignee (user
    and/or team). For a user-driven resolution we record the resolver as the assumed
    assignee only when no explicit assignee is set -- an assignment is better ground
    truth than the resolver.
    """
    row = SeerSmartAssignmentResult.objects.filter(group_id=group.id).first()
    if row is None:
        return

    updates: dict[str, object] = {}
    if trigger == SmartAssignmentTrigger.ASSIGNMENT:
        if activity is not None and (activity.data or {}).get("source") == AUTO_ASSIGN_SOURCE:
            # Our own auto-assignment from a prediction isn't independent ground
            # truth -- recording it would just score us against ourselves.
            return
        assignee = GroupAssignee.objects.filter(group=group).first()
        if assignee is None:
            return
        # Current assignment is authoritative: set whichever of user/team it is and
        # clear the other so the row reflects the latest assignee.
        updates["actual_assignee_user_id"] = assignee.user_id
        updates["actual_assignee_team_id"] = assignee.team_id
    elif trigger == SmartAssignmentTrigger.RESOLUTION:
        if activity is None or activity.user_id is None:
            return
        if row.actual_assignee_user_id is not None:
            # An explicit assignee is better ground truth than the resolver; don't
            # overwrite it with whoever happened to resolve the issue.
            return
        # No assignee yet: treat the resolving user as the assumed assignee. Keep any
        # existing team assignee (a user resolving a team-assigned issue is extra
        # signal that they're on that team, not a correction).
        updates["actual_assignee_user_id"] = activity.user_id
    else:
        return

    updates["ground_truth_source"] = trigger
    updates["ground_truth_at"] = timezone.now()
    row.update(**updates)
    metrics.incr("smart_assignment.ground_truth.recorded", tags={"trigger": trigger})

    # If the prediction was already delivered, this completes the pair and scores
    # whether our guess matched the actual assignee.
    score_prediction(row)


def _user_team_ids(organization_id: int, user_id: int) -> set[int]:
    return set(
        OrganizationMemberTeam.objects.filter(
            is_active=True,
            organizationmember__organization_id=organization_id,
            organizationmember__user_id=user_id,
        ).values_list("team_id", flat=True)
    )


def _correct_team_ids(row: SeerSmartAssignmentResult) -> set[int]:
    """The team(s) a correct prediction could belong to for this row's ground truth."""
    if row.actual_assignee_team_id is not None:
        return {row.actual_assignee_team_id}
    if row.actual_assignee_user_id is not None:
        return _user_team_ids(row.organization_id, row.actual_assignee_user_id)
    return set()


def _is_team_match(row: SeerSmartAssignmentResult) -> bool:
    """Whether the predicted user is on a team the ground truth points at."""
    correct_team_ids = _correct_team_ids(row)
    if not correct_team_ids:
        return False
    predicted_team_ids = _user_team_ids(row.organization_id, row.predicted_assignee_user_id)
    return bool(predicted_team_ids & correct_team_ids)


def score_prediction(row: SeerSmartAssignmentResult) -> None:
    """Emit `smart_assignment.scored` (exact/team/miss) once per row.

    No-op until the row has both a resolved predicted user and some ground truth (a
    user and/or team assignee), and only fires once (guarded by the stored outcome
    in `extras`).
    """
    predicted_user_id = row.predicted_assignee_user_id
    has_ground_truth = (
        row.actual_assignee_user_id is not None or row.actual_assignee_team_id is not None
    )
    if predicted_user_id is None or not has_ground_truth:
        return
    if (row.extras or {}).get(_SCORE_KEY) is not None:
        return

    if predicted_user_id == row.actual_assignee_user_id:
        outcome = "exact"
    elif _is_team_match(row):
        outcome = "team"
    else:
        outcome = "miss"

    metrics.incr("smart_assignment.scored", tags={"result": outcome, "trigger": row.trigger})
    row.update(extras={**(row.extras or {}), _SCORE_KEY: outcome})
