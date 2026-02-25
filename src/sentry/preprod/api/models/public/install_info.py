from __future__ import annotations

from typing import TypedDict

from sentry.preprod.api.models.public.shared import (
    AppInfoResponseDict,
    create_app_info_dict,
    platform_from_artifact_type,
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
    isCodeSignatureValid: bool | None
    profileName: str | None
    codesigningType: str | None
    errorCode: str | None
    errorMessage: str | None


def create_install_info_dict(artifact: PreprodArtifact) -> InstallInfoResponseDict:
    info = get_artifact_install_info(artifact)

    error_code: str | None = None
    error_message: str | None = None
    if (
        artifact.artifact_type == PreprodArtifact.ArtifactType.XCARCHIVE
        and not info.is_installable
        and info.is_code_signature_valid is False
    ):
        error_code = "INVALID_CODE_SIGNATURE"
        error_message = "Code signature is not valid"

    return {
        "buildId": str(artifact.id),
        "appInfo": create_app_info_dict(artifact),
        "platform": platform_from_artifact_type(artifact.artifact_type),
        "isInstallable": info.is_installable,
        "installUrl": info.install_url,
        "downloadCount": info.download_count,
        "releaseNotes": info.release_notes,
        "isCodeSignatureValid": info.is_code_signature_valid,
        "profileName": info.profile_name,
        "codesigningType": info.codesigning_type,
        "errorCode": error_code,
        "errorMessage": error_message,
    }
