from __future__ import annotations

from typing import TypedDict

from sentry.preprod.api.models.public.shared import (
    AppInfoResponseDict,
    GitInfoResponseDict,
    create_app_info_dict,
    create_git_info_dict,
    platform_from_artifact_type,
)
from sentry.preprod.models import PreprodArtifact


class InstallableBuildResponseDict(TypedDict):
    buildId: str
    state: str
    appInfo: AppInfoResponseDict
    gitInfo: GitInfoResponseDict | None
    platform: str | None
    projectId: str
    projectSlug: str
    buildConfiguration: str | None
    downloadCount: int
    releaseNotes: str | None


def create_installable_build_dict(artifact: PreprodArtifact) -> InstallableBuildResponseDict:
    download_count = int(getattr(artifact, "download_count", 0) or 0)

    return {
        "buildId": str(artifact.id),
        "state": PreprodArtifact.ArtifactState(artifact.state).name,
        "appInfo": create_app_info_dict(artifact),
        "gitInfo": create_git_info_dict(artifact),
        "platform": platform_from_artifact_type(artifact.artifact_type),
        "projectId": str(artifact.project_id),
        "projectSlug": artifact.project.slug,
        "buildConfiguration": (
            artifact.build_configuration.name if artifact.build_configuration else None
        ),
        "downloadCount": download_count,
        "releaseNotes": (artifact.extras or {}).get("release_notes"),
    }
