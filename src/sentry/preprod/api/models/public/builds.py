from __future__ import annotations

from typing import TypedDict

from sentry.preprod.api.models.public.shared import (
    AppInfoResponseDict,
    GitInfoResponseDict,
    create_app_info_dict,
    create_git_info_dict,
)
from sentry.preprod.models import PreprodArtifact


class BuildSummaryResponseDict(TypedDict):
    buildId: str
    state: str
    appInfo: AppInfoResponseDict
    gitInfo: GitInfoResponseDict | None
    platform: str | None
    projectId: str
    projectSlug: str
    buildConfiguration: str | None
    downloadCount: int


def _platform_from_artifact_type(artifact_type: int | None) -> str | None:
    if artifact_type is None:
        return None
    match artifact_type:
        case PreprodArtifact.ArtifactType.XCARCHIVE:
            return "ios"
        case PreprodArtifact.ArtifactType.AAB | PreprodArtifact.ArtifactType.APK:
            return "android"
        case _:
            return None


def create_build_summary_dict(artifact: PreprodArtifact) -> BuildSummaryResponseDict:
    download_count = int(getattr(artifact, "download_count", 0) or 0)

    return {
        "buildId": str(artifact.id),
        "state": PreprodArtifact.ArtifactState(artifact.state).name,
        "appInfo": create_app_info_dict(artifact),
        "gitInfo": create_git_info_dict(artifact),
        "platform": _platform_from_artifact_type(artifact.artifact_type),
        "projectId": str(artifact.project_id),
        "projectSlug": artifact.project.slug,
        "buildConfiguration": (
            artifact.build_configuration.name if artifact.build_configuration else None
        ),
        "downloadCount": download_count,
    }
