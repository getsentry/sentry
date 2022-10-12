from datetime import timedelta
from typing import Sequence

from django.utils import timezone

from sentry import features
from sentry.models import Activity, Group, GroupStatus
from sentry.signals import issue_resolved
from sentry.tasks.base import instrumented_task
from sentry.types.activity import ActivityType
from sentry.utils.suspect_resolutions import ALGO_VERSION, analytics
from sentry.utils.suspect_resolutions.commit_correlation import is_issue_commit_correlated
from sentry.utils.suspect_resolutions.metric_correlation import is_issue_error_rate_correlated


@issue_resolved.connect(weak=False)
def record_suspect_resolutions(
    organization_id, project, group, user, resolution_type, **kwargs
) -> None:
    if features.has("projects:suspect-resolutions", project):
        if (
            resolution_type == "in_next_release"
            or resolution_type == "in_release"
            or resolution_type == "with_commit"
            or resolution_type == "in_commit"
        ):
            get_suspect_resolutions.apply_async(
                kwargs={"resolved_issue_id": group.id},
                eta=timezone.now() + timedelta(hours=1),
                expires=timezone.now() + timedelta(hours=1, minutes=30),
            )
        else:
            get_suspect_resolutions.delay(group.id)


@instrumented_task(name="sentry.tasks.get_suspect_resolutions", queue="get_suspect_resolutions")
def get_suspect_resolutions(resolved_issue_id: int, **kwargs) -> Sequence[int]:
    resolved_issue = Group.objects.get(id=resolved_issue_id)
    latest_resolved_activity = (
        Activity.objects.filter(
            group=resolved_issue,
            type__in=(
                ActivityType.SET_RESOLVED.value,
                ActivityType.SET_RESOLVED_IN_COMMIT.value,
                ActivityType.SET_RESOLVED_IN_PULL_REQUEST.value,
                ActivityType.SET_RESOLVED_IN_RELEASE.value,
            ),
        )
        .order_by("-datetime")
        .values_list("type", flat=True)
        .first()
    )
    latest_resolved_activity_type = (
        ActivityType(latest_resolved_activity).name if latest_resolved_activity else None
    )

    if resolved_issue.status != GroupStatus.RESOLVED or latest_resolved_activity is None:
        return []

    suspect_issue_candidates = list(
        Group.objects.filter(
            status=GroupStatus.UNRESOLVED,
            project=resolved_issue.project,
            last_seen__lte=(resolved_issue.last_seen + timedelta(hours=1)),
            last_seen__gte=(resolved_issue.last_seen - timedelta(hours=1)),
        ).exclude(id=resolved_issue.id)[:100]
    )

    result = is_issue_error_rate_correlated(resolved_issue, suspect_issue_candidates)

    if result is None:
        return []

    correlated_issue_ids = []
    for metric_correlation_result in result.candidate_metric_correlations:
        commit_correlation = is_issue_commit_correlated(
            resolved_issue.id,
            metric_correlation_result.candidate_suspect_resolution_id,
            resolved_issue.project.id,
        )

        if metric_correlation_result.is_correlated and commit_correlation.is_correlated:
            correlated_issue_ids.append(metric_correlation_result.candidate_suspect_resolution_id)

        analytics.record(
            "suspect_resolution.evaluation",
            algo_version=ALGO_VERSION,
            resolved_group_id=resolved_issue.id,
            candidate_group_id=metric_correlation_result.candidate_suspect_resolution_id,
            resolved_group_resolution_type=latest_resolved_activity_type,
            pearson_r_coefficient=metric_correlation_result.coefficient,
            pearson_r_start_time=result.correlation_start_time,
            pearson_r_end_time=result.correlation_end_time,
            pearson_r_resolution_time=result.issue_resolved_time,
            is_commit_correlated=commit_correlation.is_correlated,
            resolved_issue_release_ids=commit_correlation.resolved_issue_release_ids,
            candidate_issue_release_ids=commit_correlation.candidate_issue_release_ids,
            resolved_issue_total_events=metric_correlation_result.resolved_issue_total_events,
            candidate_issue_total_events=metric_correlation_result.candidate_issue_total_events,
        )

    return correlated_issue_ids
