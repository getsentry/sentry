from __future__ import annotations

from sentry.preprod.models import PreprodArtifact, PreprodBuildConfiguration
from sentry.preprod.snapshots.models import (
    PreprodSnapshotComparison,
    PreprodSnapshotMetrics,
)


def find_base_snapshot_artifact(
    organization_id: int,
    base_sha: str,
    base_repo_name: str,
    project_id: int,
    app_id: str | None,
    artifact_type: str | None,
    build_configuration: PreprodBuildConfiguration | None,
) -> PreprodArtifact | None:
    return (
        PreprodArtifact.objects.filter(
            commit_comparison__organization_id=organization_id,
            commit_comparison__head_sha=base_sha,
            commit_comparison__head_repo_name=base_repo_name,
            project_id=project_id,
            preprodsnapshotmetrics__isnull=False,
            preprodsnapshotmetrics__is_selective=False,
            app_id=app_id,
            artifact_type=artifact_type,
            build_configuration=build_configuration,
        )
        .order_by("-date_added")
        .first()
    )


def find_head_snapshot_artifacts_awaiting_base(
    organization_id: int,
    base_sha: str,
    base_repo_name: str,
    project_id: int,
    app_id: str | None,
    build_configuration: PreprodBuildConfiguration | None,
) -> list[PreprodArtifact]:
    """Find head snapshot artifacts that were uploaded before their base was available.

    When a base artifact is uploaded, its commit_comparison.head_sha is the SHA that waiting
    head artifacts have as their commit_comparison.base_sha. This finds those heads so
    comparisons can be triggered retroactively.
    """
    return list(
        PreprodArtifact.objects.filter(
            commit_comparison__organization_id=organization_id,
            commit_comparison__base_sha=base_sha,
            commit_comparison__base_repo_name=base_repo_name,
            project_id=project_id,
            preprodsnapshotmetrics__isnull=False,
            app_id=app_id,
            build_configuration=build_configuration,
        )
        .exclude(
            preprodsnapshotmetrics__snapshot_comparisons_head_metrics__state=PreprodSnapshotComparison.State.SUCCESS,
        )
        .select_related("preprodsnapshotmetrics")
        .order_by("-date_added")
    )


def _comparison_has_changes(
    comparison: PreprodSnapshotComparison,
    fail_on_added: bool = False,
    fail_on_removed: bool = True,
    fail_on_changed: bool = True,
    fail_on_renamed: bool = False,
) -> bool:
    return (
        (fail_on_changed and comparison.images_changed > 0)
        or (fail_on_renamed and comparison.images_renamed > 0)
        or (fail_on_added and comparison.images_added > 0)
        or (fail_on_removed and comparison.images_removed > 0)
    )


def build_changes_map(
    artifacts: list[PreprodArtifact],
    snapshot_metrics_map: dict[int, PreprodSnapshotMetrics],
    comparisons_map: dict[int, PreprodSnapshotComparison],
    fail_on_added: bool = False,
    fail_on_removed: bool = True,
    fail_on_changed: bool = True,
    fail_on_renamed: bool = False,
) -> dict[int, bool]:
    changes_map: dict[int, bool] = {}
    for artifact in artifacts:
        metrics = snapshot_metrics_map.get(artifact.id)
        if not metrics:
            continue
        comparison = comparisons_map.get(metrics.id)
        if not comparison or comparison.state != PreprodSnapshotComparison.State.SUCCESS:
            continue
        changes_map[artifact.id] = _comparison_has_changes(
            comparison,
            fail_on_added=fail_on_added,
            fail_on_removed=fail_on_removed,
            fail_on_changed=fail_on_changed,
            fail_on_renamed=fail_on_renamed,
        )
    return changes_map
