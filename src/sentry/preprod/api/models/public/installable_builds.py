from __future__ import annotations

from typing import TypedDict

from sentry.preprod.api.models.public.shared import (
    AppInfoResponseDict,
    GitInfoResponseDict,
    create_app_info_dict,
    create_git_info_dict,
)
from sentry.preprod.build_distribution_utils import get_artifact_install_info
from sentry.preprod.models import PreprodArtifact


class InstallInfoResponseDict(TypedDict):
    buildId: str
    state: str
    appInfo: AppInfoResponseDict
    gitInfo: GitInfoResponseDict | None
    platform: str | None
    projectId: str
    projectSlug: str
    buildConfiguration: str | None
    isInstallable: bool
    installUrl: str | None
    downloadCount: int
    releaseNotes: str | None
    installGroups: list[str] | None
    isCodeSignatureValid: bool | None
    profileName: str | None
    codesigningType: str | None


class LatestInstallableBuildResponseDict(TypedDict):
    latestArtifact: InstallInfoResponseDict | None
    currentArtifact: InstallInfoResponseDict | None


def create_install_info_dict(artifact: PreprodArtifact) -> InstallInfoResponseDict:
    info = get_artifact_install_info(artifact)

    return {
        "buildId": str(artifact.id),
        "state": PreprodArtifact.ArtifactState(artifact.state).name,
        "appInfo": create_app_info_dict(artifact),
        "gitInfo": create_git_info_dict(artifact),
        # Uppercase for consistency with other enum fields (e.g. artifactType)
        "platform": artifact.platform.upper() if artifact.platform else None,
        "projectId": str(artifact.project_id),
        "projectSlug": artifact.project.slug,
        "buildConfiguration": (
            artifact.build_configuration.name if artifact.build_configuration else None
        ),
        "isInstallable": info.is_installable,
        "installUrl": info.install_url,
        "downloadCount": info.download_count,
        "releaseNotes": info.release_notes,
        "installGroups": info.install_groups,
        "isCodeSignatureValid": info.is_code_signature_valid,
        "profileName": info.profile_name,
        "codesigningType": info.codesigning_type,
    }


def create_latest_installable_build_response(
    latest: InstallInfoResponseDict | None,
    current: InstallInfoResponseDict | None,
) -> LatestInstallableBuildResponseDict:
    return {
        "latestArtifact": latest,
        "currentArtifact": current,
    }
