from __future__ import annotations

from collections.abc import Sequence
from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

from sentry.models.activity import Activity
from sentry.models.project import Project
from sentry.models.pullrequest import PullRequestLifecycleState
from sentry.seer.models.run import SeerAgentRun
from sentry.types.activity import ActivityType

AUTOFIX_STATE_VALUES = frozenset(
    {
        "merged",
        "review_pr",
        "code_changes_ready",
        "solution_ready",
        "needs_investigation",
    }
)


def _milestone_q(activity_type: ActivityType, projects: Sequence[Project]) -> Q:
    return Q(
        id__in=Activity.objects.filter(
            project__in=projects, type=activity_type.value, group_id__isnull=False
        ).values_list("group_id", flat=True)
    )


def _merged_pr_q(projects: Sequence[Project]) -> Q:
    latest_runs = (
        SeerAgentRun.objects.filter(
            project_id__in=[p.id for p in projects],
            group_id__isnull=False,
        )
        .order_by("group_id", "-id")
        .distinct("group_id")
        .values("id")
    )
    return Q(
        id__in=SeerAgentRun.objects.filter(
            id__in=latest_runs,
            run__pull_request_links__pull_request__state=PullRequestLifecycleState.MERGED,
        ).values_list("group_id", flat=True)
    )


def autofix_state_filter(
    values: list[str], projects: Sequence[Project], recency_window: timedelta
) -> Q:
    merged = _merged_pr_q(projects)
    pr_created = _milestone_q(ActivityType.SEER_PR_CREATED, projects)
    coding = _milestone_q(ActivityType.SEER_CODING_COMPLETED, projects)
    solution = _milestone_q(ActivityType.SEER_SOLUTION_COMPLETED, projects)

    conditions: dict[str, Q] = {
        "merged": merged,
        "review_pr": pr_created & ~merged,
        "code_changes_ready": coding & ~pr_created & ~merged,
        "solution_ready": solution & ~coding & ~pr_created & ~merged,
        "needs_investigation": (
            Q(seer_explorer_autofix_last_triggered__gte=timezone.now() - recency_window)
            & ~solution
            & ~coding
            & ~pr_created
            & ~merged
        ),
    }

    q = Q()
    for value in values:
        q |= conditions[value]
    return q
