from __future__ import annotations

import logging
from typing import Annotated, Literal, TypedDict, cast

from sentry.apidocs.descriptions import ApiDescription
from sentry.apidocs.formats import IsoDateTime, Url, absolute_url, iso_datetime
from sentry.preprod.api.models.public.shared import (
    AppInfoResponseDict,
    GitInfoResponseDict,
    create_app_info_dict,
    create_git_info_dict,
)
from sentry.preprod.build_distribution_utils import get_artifact_install_info
from sentry.preprod.models import PreprodArtifact

logger = logging.getLogger(__name__)

# Names of PreprodArtifact.ArtifactState
BuildState = Literal["UPLOADING", "UPLOADED", "PROCESSED", "FAILED"]


class InstallInfoResponseDict(TypedDict):
    buildId: Annotated[str, ApiDescription("ID of the build")]
    state: Annotated[BuildState, ApiDescription("State of the build")]
    appInfo: Annotated[AppInfoResponseDict, ApiDescription("App details of the build")]
    gitInfo: Annotated[
        GitInfoResponseDict | None,
        ApiDescription("Version control details of the build. Null when the build has none"),
    ]
    platform: Annotated[str | None, ApiDescription("Platform of the build, in uppercase")]
    projectId: Annotated[str, ApiDescription("ID of the project the build belongs to")]
    projectSlug: Annotated[str, ApiDescription("Slug of the project the build belongs to")]
    buildConfiguration: Annotated[
        str | None, ApiDescription("Name of the build configuration, such as Release")
    ]
    isInstallable: Annotated[bool, ApiDescription("Whether the build can be installed")]
    installUrl: Annotated[
        Url | None,
        ApiDescription("URL to install the build. Null when the build isn't installable"),
    ]
    installUrlExpiresAt: Annotated[
        IsoDateTime | None, ApiDescription("When installUrl expires (ISO 8601)")
    ]
    downloadCount: Annotated[int, ApiDescription("Number of times the build was downloaded")]
    releaseNotes: Annotated[str | None, ApiDescription("Release notes uploaded with the build")]
    installGroups: Annotated[
        list[str] | None, ApiDescription("Install groups the build belongs to")
    ]
    isCodeSignatureValid: Annotated[
        bool | None,
        ApiDescription("Whether the build's code signature is valid. Only set for Apple builds"),
    ]
    profileName: Annotated[
        str | None, ApiDescription("Name of the provisioning profile. Only set for Apple builds")
    ]
    codesigningType: Annotated[
        str | None,
        ApiDescription(
            "Code signing type, such as development or app-store. Only set for Apple builds"
        ),
    ]


class LatestInstallableBuildResponseDict(TypedDict):
    latestArtifact: Annotated[
        InstallInfoResponseDict | None,
        ApiDescription("Latest installable build that matches the filters. Null when there's none"),
    ]
    currentArtifact: Annotated[
        InstallInfoResponseDict | None,
        ApiDescription(
            "Build that matches the given buildVersion. Null when buildVersion isn't given or no build matches"
        ),
    ]


def create_install_info_dict(artifact: PreprodArtifact) -> InstallInfoResponseDict:
    info = get_artifact_install_info(artifact)

    return {
        "buildId": str(artifact.id),
        "state": cast(BuildState, PreprodArtifact.ArtifactState(artifact.state).name),
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
        "installUrl": absolute_url(info.install_url) if info.install_url is not None else None,
        "installUrlExpiresAt": (
            iso_datetime(info.install_url_expires_at)
            if info.install_url_expires_at is not None
            else None
        ),
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
    installUrlExpiresAt: str | None
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
        assert error_code_value is not None
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
                    "preprod_artifact_id": artifact.id,
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
        installUrlExpiresAt=(
            install_info.install_url_expires_at.isoformat()
            if install_info.install_url_expires_at is not None
            else None
        ),
        isCodeSignatureValid=install_info.is_code_signature_valid,
        profileName=install_info.profile_name,
        codesigningType=install_info.codesigning_type,
        errorCode=error_code_name,
        errorMessage=error_message,
    )
