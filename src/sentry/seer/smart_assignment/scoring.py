from __future__ import annotations

import logging
from typing import TypedDict

from django.db import router, transaction

from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.seer.models.run import SeerAgentRun
from sentry.seer.smart_assignment.models import (
    RESOLUTION_ACTIVITIES,
    SEER_FEATURE_ID,
    SmartAssignmentScore,
    is_unscorable_assignment,
)
from sentry.seer.utils import latest_run_for_group
from sentry.types.activity import ActivityType
from sentry.users.services.user.service import user_service
from sentry.utils import metrics

logger = logging.getLogger(__name__)

# Right now the agent only returns 3 ranked candidates; this is the limit we score against.
HIT_RANK_LIMIT = 3


class RunUpdates(TypedDict, total=False):
    """The mirrored fields we write onto a run's ``extras`` before scoring."""

    predicted_assignee_user_ids: list[int | None]
    actual_assignee_user_id: int | None
    actual_assignee_team_id: int | None
    ground_truth_source: str


def record_prediction(run: SeerAgentRun, predicted_assignee_user_ids: list[int | None]) -> None:
    """Record the predicted assignee user IDs on the run."""
    _apply(run.id, {"predicted_assignee_user_ids": predicted_assignee_user_ids})


def record_ground_truth(
    group: Group,
    activity_type: ActivityType,
    activity: Activity,
) -> None:
    """Record who the issue actually belonged to, then score the prediction.

    No-op if no run was dispatched for the group, or the outcome carries no useful
    signal (see ``_ground_truth_updates``).
    """
    run = latest_run_for_group(group.id, SEER_FEATURE_ID)
    if run is None:
        return

    updates = _ground_truth_updates(run, group, activity_type, activity)
    if updates is None:
        return

    if _apply(run.id, updates):
        metrics.incr(
            "smart_assignment.ground_truth.recorded",
            tags={"trigger": activity_type.name},
            sample_rate=1.0,
        )


def resolver_user_id(activity: Activity) -> int | None:
    """The user a resolution can be credited to, or ``None`` when it names no one who
    could have owned the issue.

    Automatic resolutions (auto-resolve, resolve-in-next-release) have no acting user.
    A resolution driven through an integration -- a Linear ticket moving to Done, say --
    acts as the Sentry App's proxy user (``is_sentry_app``), which identifies the app
    rather than a person.
    """
    if activity.user_id is None:
        return None
    user = user_service.get_user(user_id=activity.user_id)
    if user is None or user.is_sentry_app:
        return None
    return user.id


def _ground_truth_updates(
    run: SeerAgentRun,
    group: Group,
    activity_type: ActivityType,
    activity: Activity,
) -> RunUpdates | None:
    """Build the ground-truth mirror updates for an activity, or ``None`` when it
    carries no useful signal.

    For any activity we mirror the current assignee (user and/or team), unless it is
    from a source in ``UNSCORABLE_ASSIGNMENT_ORIGINS``.
    For a user-driven resolution we record the resolver as the assumed assignee only
    when no explicit assignee has been recorded -- an assignment is better truth.
    """
    assignment = _assignment_updates(group)
    if assignment is not None:
        return assignment
    if activity_type in RESOLUTION_ACTIVITIES:
        resolver_id = resolver_user_id(activity)
        if resolver_id is None:
            # If we don't have a resolver user ID, we can't score the prediction.
            return None
        extras = run.extras or {}
        if (
            extras.get("actual_assignee_user_id") is not None
            or extras.get("actual_assignee_team_id") is not None
        ):
            # A prior team assignee is treated as enough truth, so we drop the
            # resolver. (Could go the other way: merge the resolver in as the user.)
            return None
        return {
            "actual_assignee_user_id": resolver_id,
            "ground_truth_source": activity_type.name,
        }
    return None


def _assignment_updates(group: Group) -> RunUpdates | None:
    """Mirror the current assignee (user and/or team), or ``None`` when the group has
    no assignee or the assignment is one we can't grade a prediction against.
    """
    assignee = GroupAssignee.objects.filter(group=group).first()
    if assignee is None:
        return None
    if _has_unscorable_assignment(group):
        return None
    return {
        "actual_assignee_user_id": assignee.user_id,
        "actual_assignee_team_id": assignee.team_id,
        "ground_truth_source": ActivityType.ASSIGNED.name,
    }


def _has_unscorable_assignment(group: Group) -> bool:
    """Whether the group's current assignment came from a source we can't grade a
    prediction against. The latest ASSIGNED activity always represents the current assignment,
    and its ``integration`` indicates if it came from a human or not.
    """
    return is_unscorable_assignment(
        Activity.objects.filter(group=group, type=ActivityType.ASSIGNED.value)
        # ``id`` breaks ties so same-timestamp activities resolve to the one written last.
        .order_by("-datetime", "-id")
        .first()
    )


def _apply(run_id: int, updates: RunUpdates) -> bool:
    """Record the delivered ranked picks (best-first, each resolved to a user) on the
    run mirror, then score if the ground truth already landed. Returns whether the updates were
    persisted -- ``False`` when the row is already a terminal snapshot."""
    with transaction.atomic(using=router.db_for_write(SeerAgentRun)):
        run = (
            SeerAgentRun.objects.select_for_update().select_related("run").filter(id=run_id).first()
        )
        if run is None:
            return False
        extras = dict(run.extras or {})
        if extras.get("result"):
            # The row is a terminal snapshot once scored. Applying later prediction or
            # ground-truth updates would drift the mirrored fields away from what we
            # actually scored against, leaving `result`/`hit_rank` inconsistent.
            return False
        if all(key in extras and extras[key] == value for key, value in updates.items()):
            # The "update" would be a no-op.
            return False
        extras.update(updates)
        # Score the prediction against the ground truth if it's already landed.
        result, hit_rank = _score(
            run.run.organization_id,
            predicted_user_ids=extras.get("predicted_assignee_user_ids") or [],
            actual_user_id=extras.get("actual_assignee_user_id"),
            actual_team_id=extras.get("actual_assignee_team_id"),
        )
        if result is not None:
            extras["result"] = str(result)
            extras["hit_rank"] = hit_rank
        run.extras = extras
        run.save(update_fields=["extras"])

    if result is not None:
        metrics.incr(
            "smart_assignment.scored",
            tags={
                "result": str(result),
                # Ranks start at 1; 0 means no predicted user matched the ground truth.
                "hit_rank": hit_rank if hit_rank is not None else 0,
                "trigger": extras.get("trigger"),
            },
            sample_rate=1.0,
        )
    return True


def _score(
    organization_id: int,
    predicted_user_ids: list[int | None],
    actual_user_id: int | None,
    actual_team_id: int | None,
) -> tuple[SmartAssignmentScore | None, int | None]:
    """Score the prediction against the ground truth if we have both.
    The top-predicted user is scored with EXACT if it's a match, TEAM if the prediction shares
    a team with the ground truth, or MISS otherwise (including when we couldn't resolve the prediction to an org user).
    hit_rank records the rank of the top-predicted user that matched the ground truth,
    so we can track how often #2 or #3 was correct too.
    """
    if not predicted_user_ids:
        # No prediction; do nothing.
        return None, None
    if actual_user_id is None and actual_team_id is None:
        # No ground truth (yet); do nothing.
        return None, None

    hit_rank: int | None = None
    if actual_user_id is not None:
        # Score the prediction against the ground truth.
        for rank, user_id in enumerate(predicted_user_ids[:HIT_RANK_LIMIT], start=1):
            if user_id == actual_user_id:
                hit_rank = rank
                break

    # A top pick we couldn't resolve to an org user (None) can't be EXACT or TEAM, so
    # it's a miss -- but a lower-ranked candidate may still have named the assignee,
    # which `hit_rank` records.
    predicted_user_id = predicted_user_ids[0]
    if predicted_user_id is not None:
        if predicted_user_id == actual_user_id:
            return SmartAssignmentScore.EXACT, hit_rank
        if _is_team_match(organization_id, predicted_user_id, actual_user_id, actual_team_id):
            return SmartAssignmentScore.TEAM, hit_rank
    return SmartAssignmentScore.MISS, hit_rank


def _user_team_ids(organization_id: int, user_id: int) -> set[int]:
    return set(
        OrganizationMemberTeam.objects.filter(
            is_active=True,
            organizationmember__organization_id=organization_id,
            organizationmember__user_id=user_id,
        ).values_list("team_id", flat=True)
    )


def _correct_team_ids(
    organization_id: int, actual_user_id: int | None, actual_team_id: int | None
) -> set[int]:
    """The team(s) a correct prediction could belong to for this ground truth."""
    if actual_team_id is not None:
        return {actual_team_id}
    if actual_user_id is not None:
        return _user_team_ids(organization_id, actual_user_id)
    return set()


def _is_team_match(
    organization_id: int,
    predicted_user_id: int,
    actual_user_id: int | None,
    actual_team_id: int | None,
) -> bool:
    """Whether the predicted user is on a team the ground truth points at."""
    correct_team_ids = _correct_team_ids(organization_id, actual_user_id, actual_team_id)
    if not correct_team_ids:
        return False
    return bool(_user_team_ids(organization_id, predicted_user_id) & correct_team_ids)
