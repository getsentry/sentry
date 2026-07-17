from __future__ import annotations

import logging
from typing import Any

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
)
from sentry.types.activity import ActivityType
from sentry.utils import metrics

logger = logging.getLogger(__name__)

# How far down the ranked candidate list a correct name still earns a hit rank. The
# agent delivers a short best-first list; a match past this is treated as a miss.
HIT_RANK_LIMIT = 3


def _get_run(group_id: int) -> SeerAgentRun | None:
    """The canonical smart-assignment run mirror for a group (latest wins).

    Dedup keeps this to one per group in practice; always picking the latest keeps the
    prediction and ground-truth writers agreeing on the same row even in the rare case
    a race dispatched more than one run, and matches the run Seer most recently
    delivered against.
    """
    return (
        SeerAgentRun.objects.filter(group_id=group_id, source=SEER_FEATURE_ID)
        .select_related("run")
        .order_by("-date_added")
        .first()
    )


def record_prediction(group_id: int, predicted_assignee_user_ids: list[int | None]) -> None:
    """Record the delivered ranked picks (best-first, each resolved to a user) on the
    run mirror, then score if the ground truth already landed. A position we couldn't
    map to an org user is stored as ``None`` so each candidate keeps its rank; an
    empty list means the agent abstained. Stored so we don't re-treat the run as
    undelivered, but never scored on its own -- scoring waits for ground truth."""
    run = _get_run(group_id)
    if run is None:
        return
    _apply(run.id, {"predicted_assignee_user_ids": predicted_assignee_user_ids})


def record_ground_truth(
    group: Group,
    activity_type: ActivityType,
    activity: Activity | None = None,
) -> None:
    """Record who the issue actually belonged to on the run mirror, then score.

    No-op if no run was dispatched for the group, or the outcome carries no useful
    signal: a Seer AI-step start or an automatic resolution with no acting user.
    For an assignment we mirror the current assignee (user and/or team). For a
    user-driven resolution we record the resolver as the assumed assignee only when no
    explicit assignee has been recorded -- an assignment is better truth.
    """
    run = _get_run(group.id)
    if run is None:
        return

    updates: dict[str, Any] = {}
    if activity_type == ActivityType.ASSIGNED:
        assignee = GroupAssignee.objects.filter(group=group).first()
        if assignee is None:
            return
        updates["actual_assignee_user_id"] = assignee.user_id
        updates["actual_assignee_team_id"] = assignee.team_id
    elif activity_type in RESOLUTION_ACTIVITIES:
        if activity is None or activity.user_id is None:
            return
        if (run.extras or {}).get("actual_assignee_user_id") is not None:
            # An explicit assignee is better ground truth than the resolver.
            return
        updates["actual_assignee_user_id"] = activity.user_id
    else:
        return

    updates["ground_truth_source"] = activity_type.name
    _apply(run.id, updates)
    metrics.incr("smart_assignment.ground_truth.recorded", tags={"trigger": activity_type.name})


def _apply(run_id: int, updates: dict[str, Any]) -> None:
    """Merge `updates` into the run mirror's extras under a row lock and, if that
    completes the (prediction, ground truth) pair, emit `smart_assignment.scored`
    once. The lock serializes the prediction and ground-truth writers so neither a
    lost update nor a double emit is possible."""
    with transaction.atomic(using=router.db_for_write(SeerAgentRun)):
        run = SeerAgentRun.objects.select_for_update().select_related("run").get(id=run_id)
        extras = dict(run.extras or {})
        if extras.get("result"):
            # The row is a terminal snapshot once scored. Applying later prediction or
            # ground-truth updates would drift the mirrored fields away from what we
            # actually scored against, leaving `result`/`hit_rank` inconsistent.
            return
        extras.update(updates)
        result, hit_rank = _score(run.run.organization_id, extras)
        if result is not None:
            extras["result"] = str(result)
            extras["hit_rank"] = hit_rank
        run.extras = extras
        run.save(update_fields=["extras"])

    if result is not None:
        metrics.incr(
            "smart_assignment.scored",
            tags={"result": str(result), "hit_rank": hit_rank, "trigger": extras.get("trigger")},
        )


def _score(
    organization_id: int, extras: dict[str, Any]
) -> tuple[SmartAssignmentScore | None, int | None]:
    """Grade the ranked predictions in `extras` against the ground truth, returning the
    top pick's coarse outcome paired with the 1-based rank at which the actual assignee
    appears (capped at `HIT_RANK_LIMIT`, None if they aren't among those top picks so a
    correct-but-not-top name still counts for something). None if the pair isn't
    complete yet or it's already been scored."""
    if extras.get("result"):
        return None, None
    predicted_user_ids = extras.get("predicted_assignee_user_ids") or []
    actual_user_id = extras.get("actual_assignee_user_id")
    actual_team_id = extras.get("actual_assignee_team_id")
    if not predicted_user_ids:
        return None, None
    if actual_user_id is None and actual_team_id is None:
        return None, None

    hit_rank: int | None = None
    if actual_user_id is not None:
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
