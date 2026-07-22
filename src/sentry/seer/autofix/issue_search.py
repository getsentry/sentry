from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from django.db.models import Case, DateTimeField, Max, OuterRef, Q, Subquery, Value, When
from django.db.models.functions import Coalesce
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

MILESTONE_ACTIVITY_TYPES = (
    ActivityType.SEER_SOLUTION_COMPLETED,
    ActivityType.SEER_CODING_COMPLETED,
    ActivityType.SEER_PR_CREATED,
)

NO_RUN_THRESHOLD = datetime(1970, 1, 1, tzinfo=UTC)


def _latest_run_started() -> Coalesce:
    return Coalesce(
        Subquery(
            SeerAgentRun.objects.filter(group_id=OuterRef("group_id"), source="autofix")
            .order_by("-id")
            .values("run__date_added")[:1]
        ),
        Value(NO_RUN_THRESHOLD),
        output_field=DateTimeField(),
    )


def _milestone_state_q(
    projects: Sequence[Project],
    reached: ActivityType,
    not_reached: Sequence[ActivityType],
) -> Q:
    types = (reached, *not_reached)
    annotations = {
        f"latest_{t.value}": Max(Case(When(type=t.value, then="datetime"))) for t in types
    }
    condition = Q(**{f"latest_{reached.value}__gte": _latest_run_started()})
    for t in not_reached:
        condition &= Q(**{f"latest_{t.value}__lt": _latest_run_started()}) | Q(
            **{f"latest_{t.value}__isnull": True}
        )
    return Q(
        id__in=Activity.objects.filter(
            project__in=projects,
            type__in=[t.value for t in types],
            group_id__isnull=False,
        )
        .values("group_id")
        .annotate(**annotations)
        .filter(condition)
        .values_list("group_id", flat=True)
    )


def _any_milestone_q(projects: Sequence[Project]) -> Q:
    return Q(
        id__in=Activity.objects.filter(
            project__in=projects,
            type__in=[t.value for t in MILESTONE_ACTIVITY_TYPES],
            group_id__isnull=False,
        )
        .values("group_id")
        .annotate(latest_milestone=Max("datetime"))
        .filter(latest_milestone__gte=_latest_run_started())
        .values_list("group_id", flat=True)
    )


def _merged_pr_q(projects: Sequence[Project]) -> Q:
    latest_runs = (
        SeerAgentRun.objects.filter(
            project_id__in=[p.id for p in projects],
            group_id__isnull=False,
            source="autofix",
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
    if not values:
        return Q(id__in=[])

    merged = _merged_pr_q(projects)

    conditions: dict[str, Q] = {
        "merged": merged,
        "review_pr": _milestone_state_q(projects, ActivityType.SEER_PR_CREATED, []) & ~merged,
        "code_changes_ready": (
            _milestone_state_q(
                projects,
                ActivityType.SEER_CODING_COMPLETED,
                [ActivityType.SEER_PR_CREATED],
            )
            & ~merged
        ),
        "solution_ready": (
            _milestone_state_q(
                projects,
                ActivityType.SEER_SOLUTION_COMPLETED,
                [ActivityType.SEER_CODING_COMPLETED, ActivityType.SEER_PR_CREATED],
            )
            & ~merged
        ),
        "needs_investigation": (
            Q(seer_explorer_autofix_last_triggered__gte=timezone.now() - recency_window)
            & ~_any_milestone_q(projects)
            & ~merged
        ),
    }

    q = Q()
    for value in values:
        q |= conditions[value]
    return q
