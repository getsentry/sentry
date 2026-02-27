from __future__ import annotations

from sentry.preprod.models import PreprodArtifact, PreprodBuildConfiguration


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
            app_id=app_id,
            artifact_type=artifact_type,
            build_configuration=build_configuration,
        )
        .order_by("-date_added")
        .first()
    )
