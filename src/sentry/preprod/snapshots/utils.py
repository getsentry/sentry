from __future__ import annotations

from dataclasses import dataclass

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
    qs = PreprodArtifact.objects.filter(
        commit_comparison__organization_id=organization_id,
        commit_comparison__head_sha=base_sha,
        commit_comparison__head_repo_name=base_repo_name,
        project_id=project_id,
        preprodsnapshotmetrics__isnull=False,
        app_id=app_id,
        artifact_type=artifact_type,
        build_configuration=build_configuration,
    )
    return qs.order_by("-date_added").first()


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


@dataclass(frozen=True)
class SnapshotChangeCriteria:
    """Snapshot change categories relevant to a consumer."""

    added: bool
    removed: bool
    changed: bool
    renamed: bool


def _comparison_matches_change_criteria(
    comparison: PreprodSnapshotComparison, criteria: SnapshotChangeCriteria
) -> bool:
    """Return whether a comparison contains a selected change category."""
    return (
        (criteria.changed and comparison.images_changed > 0)
        or (criteria.renamed and comparison.images_renamed > 0)
        or (criteria.added and comparison.images_added > 0)
        or (criteria.removed and comparison.images_removed > 0)
    )


def evaluate_snapshot_changes_by_artifact_id(
    artifacts: list[PreprodArtifact],
    snapshot_metrics_map: dict[int, PreprodSnapshotMetrics],
    comparisons_map: dict[int, PreprodSnapshotComparison],
    criteria: SnapshotChangeCriteria,
) -> dict[int, bool]:
    """Return whether each successfully compared artifact matches the selected change criteria."""
    changes_map: dict[int, bool] = {}
    for artifact in artifacts:
        metrics = snapshot_metrics_map.get(artifact.id)
        if not metrics:
            continue
        comparison = comparisons_map.get(metrics.id)
        if not comparison or comparison.state != PreprodSnapshotComparison.State.SUCCESS:
            continue
        changes_map[artifact.id] = _comparison_matches_change_criteria(comparison, criteria)
    return changes_map
