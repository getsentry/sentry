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
# PULL_REQUESTS_MERGED is reconciled separately from linked PR lifecycle state.
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
        description = (artifacts["root_cause"].data or {}).get("one_line_description")
        result[SeerRunMilestoneType.ROOT_CAUSE] = (
            {"root_cause_artifact": {"one_line_description": description}}
            if isinstance(description, str)
            else {}
        )
    if "solution" in artifacts:
        summary = (artifacts["solution"].data or {}).get("one_line_summary")
        result[SeerRunMilestoneType.SOLUTION] = (
            {"solution_artifact": {"one_line_summary": summary}} if isinstance(summary, str) else {}
        )
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
    for milestone in sorted(SEER_STATE_MILESTONES):
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


def reconcile_pull_requests_merged_milestone(seer_run: SeerRun) -> bool:
    """Make PULL_REQUESTS_MERGED match the current state of every linked PR.

    Reconciliations for one run are serialized so concurrent link and merge events
    cannot apply their decisions out of order.
    """
    database = router.db_for_write(SeerRunMilestone)
    with transaction.atomic(using=database):
        SeerRun.objects.select_for_update().values_list("id", flat=True).get(id=seer_run.id)
        states = list(seer_run.pull_requests.values_list("state", flat=True))
        milestone = SeerRunMilestone.objects.filter(
            seer_run=seer_run,
            milestone=SeerRunMilestoneType.PULL_REQUESTS_MERGED,
        )

        all_prs_merged = bool(states) and all(
            state == PullRequestLifecycleState.MERGED for state in states
        )
        if not all_prs_merged:
            milestone.delete()
            return False

        SeerRunMilestone.objects.bulk_create(
            [
                SeerRunMilestone(
                    seer_run=seer_run,
                    milestone=SeerRunMilestoneType.PULL_REQUESTS_MERGED,
                )
            ],
            ignore_conflicts=True,
        )
        return True
