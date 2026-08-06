from __future__ import annotations

from typing import TYPE_CHECKING

from django.db import router, transaction

from sentry.models.pullrequest import PullRequestLifecycleState
from sentry.seer.models.run import (
    SeerRun,
    SeerRunMilestone,
    SeerRunMilestoneExtras,
    SeerRunMilestoneType,
)

if TYPE_CHECKING:
    from sentry.seer.agent.client_models import SeerRunState

# The milestone subset derived from and reconciled against Seer run state.
# PULL_REQUESTS_MERGED is excluded: it is owned by the PR-merge webhook.
SEER_STATE_MILESTONES = frozenset(
    {
        SeerRunMilestoneType.ROOT_CAUSE,
        SeerRunMilestoneType.SOLUTION,
        SeerRunMilestoneType.CODE_CHANGES,
        SeerRunMilestoneType.HAS_PULL_REQUEST,
    }
)


def _has_pull_request(state: SeerRunState) -> bool:
    # Native Seer PRs mark a pushed block; coding-agent PRs live in coding_agents.
    # pr_number (not pr_url, which may be a pushed branch) confirms an actual PR.
    if any(block.pr_commit_shas for block in state.blocks):
        return True
    return any(
        result.pr_number is not None
        for agent in state.coding_agents.values()
        for result in agent.results
    )


def milestones_from_state(state: SeerRunState) -> dict[str, SeerRunMilestoneExtras]:
    """Derive reached milestones (and their extras) from ``state.blocks`` (not
    ``repo_pr_states``, which persists across a re-run) so a re-run shrinks the set.
    """
    result: dict[str, SeerRunMilestoneExtras] = {}
    artifacts = state.get_artifacts()
    if "root_cause" in artifacts:
        data = artifacts["root_cause"].data
        result[SeerRunMilestoneType.ROOT_CAUSE] = {"root_cause_artifact": data} if data else {}
    if "solution" in artifacts:
        data = artifacts["solution"].data
        result[SeerRunMilestoneType.SOLUTION] = {"solution_artifact": data} if data else {}
    if state.get_diffs_by_repo():
        result[SeerRunMilestoneType.CODE_CHANGES] = {}
    if _has_pull_request(state):
        result[SeerRunMilestoneType.HAS_PULL_REQUEST] = {}
    return result


def reconcile_milestones(seer_run: SeerRun, state: SeerRunState) -> None:
    """Make the run's SEER_STATE_MILESTONES match what ``state`` has reached,
    inserting/refreshing extras and deleting ones a re-run undid. Milestones
    outside that set (e.g. PULL_REQUESTS_MERGED) are left untouched.
    """
    reached = milestones_from_state(state)
    desired = {}
    for milestone in SEER_STATE_MILESTONES:
        if milestone in reached:
            desired[milestone] = reached[milestone]

    with transaction.atomic(using=router.db_for_write(SeerRunMilestone)):
        existing = set(
            SeerRunMilestone.objects.filter(
                seer_run=seer_run, milestone__in=SEER_STATE_MILESTONES
            ).values_list("milestone", flat=True)
        )
        to_delete = existing - desired.keys()
        if to_delete:
            SeerRunMilestone.objects.filter(seer_run=seer_run, milestone__in=to_delete).delete()

        if desired:
            SeerRunMilestone.objects.bulk_create(
                [
                    SeerRunMilestone(seer_run=seer_run, milestone=milestone, extras=extras)
                    for milestone, extras in desired.items()
                ],
                update_conflicts=True,
                unique_fields=["seer_run", "milestone"],
                update_fields=["extras", "date_updated"],
            )


def record_has_pull_request(seer_run: SeerRun) -> None:
    # Coding-agent PRs land via the async status sync, after the step webhook that
    # runs reconcile_milestones; record the milestone here so it isn't missed.
    SeerRunMilestone.objects.get_or_create(
        seer_run=seer_run, milestone=SeerRunMilestoneType.HAS_PULL_REQUEST
    )


def record_pull_requests_merged(seer_run: SeerRun) -> bool:
    """Record PULL_REQUESTS_MERGED once every PR the run opened is merged. Owned by
    the PR-merge webhook, so it sits outside the set ``reconcile_milestones`` manages.
    """
    # Known limitation: this milestone is never cleared, so it goes stale if PRs are
    # linked after an earlier one merges (staggered handoffs / killswitch) or on re-run.
    states = list(seer_run.pull_requests.values_list("state", flat=True))
    if not states:
        return False
    if any(state != PullRequestLifecycleState.MERGED for state in states):
        return False

    SeerRunMilestone.objects.bulk_create(
        [SeerRunMilestone(seer_run=seer_run, milestone=SeerRunMilestoneType.PULL_REQUESTS_MERGED)],
        ignore_conflicts=True,
    )
    return True
