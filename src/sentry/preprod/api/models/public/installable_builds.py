from __future__ import annotations

from typing import TypedDict

from sentry.preprod.api.models.public.shared import (
    AppInfoResponseDict,
    create_app_info_dict,
)
from sentry.preprod.build_distribution_utils import get_artifact_install_info
from sentry.preprod.models import PreprodArtifact


class InstallInfoResponseDict(TypedDict):
    buildId: str
    appInfo: AppInfoResponseDict
    platform: str | None
    isInstallable: bool
    installUrl: str | None
    downloadCount: int
    releaseNotes: str | None
    installGroups: list[str] | None
    isCodeSignatureValid: bool | None
    profileName: str | None
    codesigningType: str | None


def create_install_info_dict(artifact: PreprodArtifact) -> InstallInfoResponseDict:
    info = get_artifact_install_info(artifact)

    return {
        "buildId": str(artifact.id),
        "appInfo": create_app_info_dict(artifact),
        # Uppercase for consistency with other enum fields (e.g. artifactType)
        "platform": artifact.platform.upper() if artifact.platform else None,
        "isInstallable": info.is_installable,
        "installUrl": info.install_url,
        "downloadCount": info.download_count,
        "releaseNotes": info.release_notes,
        "installGroups": info.install_groups,
        "isCodeSignatureValid": info.is_code_signature_valid,
        "profileName": info.profile_name,
        "codesigningType": info.codesigning_type,
    }
