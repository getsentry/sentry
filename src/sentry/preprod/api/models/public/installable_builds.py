from __future__ import annotations

import logging
from typing import TypedDict

from sentry.preprod.api.models.public.shared import (
    AppInfoResponseDict,
    GitInfoResponseDict,
    create_app_info_dict,
    create_git_info_dict,
)
from sentry.preprod.build_distribution_utils import get_artifact_install_info
from sentry.preprod.models import PreprodArtifact

logger = logging.getLogger(__name__)


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


class BuildDistributionSummaryBuildError(Exception):
    """Raised when the summary builder encounters an unrecoverable data error."""


class BuildDistributionSummaryResponseDict(TypedDict):
    """Webhook payload shape for ``build_distribution_completed``.

    A strict subset of the public install-info API response, excluding
    transient/mutable fields (``downloadCount``, ``releaseNotes``,
    ``installGroups``).  Adds ``organizationSlug`` and webhook-specific
    ``state`` / error fields for routing and failure reporting.
    """

    buildId: str
    organizationSlug: str
    projectId: str
    projectSlug: str
    platform: str | None
    state: str  # "COMPLETED" | "FAILED"
    appInfo: AppInfoResponseDict
    gitInfo: GitInfoResponseDict | None
    buildConfiguration: str | None
    isInstallable: bool
    installUrl: str | None
    isCodeSignatureValid: bool | None
    profileName: str | None
    codesigningType: str | None
    errorCode: str | None
    errorMessage: str | None


def build_build_distribution_summary(
    artifact: PreprodArtifact,
) -> BuildDistributionSummaryResponseDict | None:
    """Build a webhook-ready summary of build distribution results.

    Returns ``None`` for non-terminal states (no ``installable_app_file_id``
    and no ``installable_app_error_code``).

    Raises :class:`BuildDistributionSummaryBuildError` when persisted data
    cannot be mapped (e.g. invalid error code).
    """
    error_code_value = artifact.installable_app_error_code
    has_file = artifact.installable_app_file_id is not None
    has_error = error_code_value is not None

    # Non-terminal: neither success nor failure fields are set
    if not has_file and not has_error:
        return None

    # Determine webhook-level terminal state
    if has_error:
        state = "FAILED"
        try:
            error_code_name = PreprodArtifact.InstallableAppErrorCode(error_code_value).name
        except ValueError:
            raise BuildDistributionSummaryBuildError(
                f"Invalid installable_app_error_code: {error_code_value}"
            )
        error_message = artifact.installable_app_error_message

        if has_file:
            logger.warning(
                "preprod.build_distribution.summary.both_file_and_error",
                extra={
                    "artifact_id": artifact.id,
                    "error_code": error_code_value,
                },
            )
    else:
        state = "COMPLETED"
        error_code_name = None
        error_message = None

    install_info = get_artifact_install_info(artifact)
    platform = artifact.platform

    return BuildDistributionSummaryResponseDict(
        buildId=str(artifact.id),
        organizationSlug=artifact.project.organization.slug,
        projectId=str(artifact.project_id),
        projectSlug=artifact.project.slug,
        platform=platform.value.upper() if platform is not None else None,
        state=state,
        appInfo=create_app_info_dict(artifact),
        gitInfo=create_git_info_dict(artifact),
        buildConfiguration=(
            artifact.build_configuration.name if artifact.build_configuration else None
        ),
        isInstallable=install_info.is_installable,
        installUrl=install_info.install_url,
        isCodeSignatureValid=install_info.is_code_signature_valid,
        profileName=install_info.profile_name,
        codesigningType=install_info.codesigning_type,
        errorCode=error_code_name,
        errorMessage=error_message,
    )
