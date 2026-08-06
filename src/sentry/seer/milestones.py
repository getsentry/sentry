from __future__ import annotations

from typing import TYPE_CHECKING

from django.db import router, transaction

from sentry.models.pullrequest import PullRequestLifecycleState
from sentry.seer.models.run import SeerRun, SeerRunMilestone, SeerRunMilestoneType

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


def milestones_from_state(state: SeerRunState) -> set[str]:
    """Derive reached milestones from ``state.blocks`` (not ``repo_pr_states``,
    which persists across a re-run) so a re-run correctly shrinks the set.
    """
    milestones: set[str] = set()
    artifacts = state.get_artifacts()
    if "root_cause" in artifacts:
        milestones.add(SeerRunMilestoneType.ROOT_CAUSE)
    if "solution" in artifacts:
        milestones.add(SeerRunMilestoneType.SOLUTION)
    if state.get_diffs_by_repo():
        milestones.add(SeerRunMilestoneType.CODE_CHANGES)
    if _has_pull_request(state):
        milestones.add(SeerRunMilestoneType.HAS_PULL_REQUEST)
    return milestones


def reconcile_milestones(seer_run: SeerRun, state: SeerRunState) -> None:
    """Make the run's SEER_STATE_MILESTONES match what ``state`` has reached,
    inserting newly-reached ones and deleting ones a re-run undid. Milestones
    outside that set (e.g. PULL_REQUESTS_MERGED) are left untouched.
    """
    desired_managed = milestones_from_state(state) & SEER_STATE_MILESTONES
    with transaction.atomic(using=router.db_for_write(SeerRunMilestone)):
        existing = set(
            SeerRunMilestone.objects.filter(
                seer_run=seer_run, milestone__in=SEER_STATE_MILESTONES
            ).values_list("milestone", flat=True)
        )
        to_delete = existing - desired_managed
        if to_delete:
            SeerRunMilestone.objects.filter(seer_run=seer_run, milestone__in=to_delete).delete()

        to_insert = desired_managed - existing
        if to_insert:
            SeerRunMilestone.objects.bulk_create(
                [SeerRunMilestone(seer_run=seer_run, milestone=m) for m in to_insert],
                ignore_conflicts=True,
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
