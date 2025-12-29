from __future__ import annotations

import logging
from enum import StrEnum
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field

from sentry.preprod.build_distribution_utils import is_installable_artifact
from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics
from sentry.preprod.vcs.status_checks.size.tasks import StatusCheckErrorType

logger = logging.getLogger(__name__)


class Platform(StrEnum):
    IOS = "ios"
    ANDROID = "android"
    MACOS = "macos"


class AppleAppInfo(BaseModel):
    has_missing_dsym_binaries: bool = False


class AndroidAppInfo(BaseModel):
    has_proguard_mapping: bool = True


class BuildDetailsAppInfo(BaseModel):
    app_id: str | None
    name: str | None
    version: str | None
    build_number: int | None = None
    date_added: str | None = None
    date_built: str | None = None
    artifact_type: PreprodArtifact.ArtifactType | None = None
    platform: Platform | None = None
    is_installable: bool
    build_configuration: str | None = None
    app_icon_id: str | None = None
    apple_app_info: AppleAppInfo | None = None
    android_app_info: AndroidAppInfo | None = None


class BuildDetailsVcsInfo(BaseModel):
    head_sha: str | None = None
    base_sha: str | None = None
    provider: str | None = None
    head_repo_name: str | None = None
    base_repo_name: str | None = None
    head_ref: str | None = None
    base_ref: str | None = None
    pr_number: int | None = None


class StatusCheckResultSuccess(BaseModel):
    """Result of a successfully posted status check."""

    success: Literal[True] = True
    check_id: str | None = None


class StatusCheckResultFailure(BaseModel):
    """Result of a failed status check post."""

    success: Literal[False] = False
    error_type: StatusCheckErrorType | None = None


StatusCheckResult = Annotated[
    StatusCheckResultSuccess | StatusCheckResultFailure,
    Field(discriminator="success"),
]


class PostedStatusChecks(BaseModel):
    """Status checks that have been posted to the VCS provider."""

    size: StatusCheckResult | None = None


class SizeInfoSizeMetric(BaseModel):
    metrics_artifact_type: PreprodArtifactSizeMetrics.MetricsArtifactType
    install_size_bytes: int
    download_size_bytes: int


class SizeInfoPending(BaseModel):
    state: Literal[PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING] = (
        PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING
    )


class SizeInfoProcessing(BaseModel):
    state: Literal[PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING] = (
        PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING
    )


class SizeInfoCompleted(BaseModel):
    state: Literal[PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED] = (
        PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED
    )
    # Deprecated, use size_metrics instead
    install_size_bytes: int
    # Deprecated, use size_metrics instead
    download_size_bytes: int
    size_metrics: list[SizeInfoSizeMetric]
    base_size_metrics: list[SizeInfoSizeMetric]


class SizeInfoFailed(BaseModel):
    state: Literal[PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED] = (
        PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED
    )
    error_code: int
    error_message: str


SizeInfo = Annotated[
    SizeInfoPending | SizeInfoProcessing | SizeInfoCompleted | SizeInfoFailed,
    Field(discriminator="state"),
]


class BuildDetailsApiResponse(BaseModel):
    id: str
    state: PreprodArtifact.ArtifactState
    app_info: BuildDetailsAppInfo
    vcs_info: BuildDetailsVcsInfo
    project_id: int
    project_slug: str
    size_info: SizeInfo | None = None
    posted_status_checks: PostedStatusChecks | None = None
    base_artifact_id: str | None = None
    base_build_info: BuildDetailsAppInfo | None = None


def platform_from_artifact_type(artifact_type: PreprodArtifact.ArtifactType) -> Platform:
    match artifact_type:
        case PreprodArtifact.ArtifactType.XCARCHIVE:
            return Platform.IOS
        case PreprodArtifact.ArtifactType.AAB:
            return Platform.ANDROID
        case PreprodArtifact.ArtifactType.APK:
            return Platform.ANDROID
        case _:
            raise ValueError(f"Unknown artifact type: {artifact_type}")


def create_build_details_app_info(artifact: PreprodArtifact) -> BuildDetailsAppInfo:
    """Factory function to create BuildDetailsAppInfo from a PreprodArtifact."""
    platform = None
    # artifact_type can be null before preprocessing has completed
    if artifact.artifact_type is not None:
        platform = platform_from_artifact_type(artifact.artifact_type)

    apple_app_info = None
    if platform == Platform.IOS or platform == Platform.MACOS:
        legacy_missing_dsym_binaries = (
            artifact.extras.get("missing_dsym_binaries", []) if artifact.extras else []
        )
        has_missing_dsym_binaries = (
            artifact.extras.get("has_missing_dsym_binaries", False)
            or len(legacy_missing_dsym_binaries) > 0
            if artifact.extras
            else False
        )
        apple_app_info = AppleAppInfo(has_missing_dsym_binaries=has_missing_dsym_binaries)

    android_app_info = None
    if platform == Platform.ANDROID:
        android_app_info = AndroidAppInfo(
            has_proguard_mapping=(
                artifact.extras.get("has_proguard_mapping", True) if artifact.extras else True
            )
        )

    return BuildDetailsAppInfo(
        app_id=artifact.app_id,
        name=artifact.app_name,
        version=artifact.build_version,
        build_number=artifact.build_number,
        date_added=(artifact.date_added.isoformat() if artifact.date_added else None),
        date_built=(artifact.date_built.isoformat() if artifact.date_built else None),
        artifact_type=artifact.artifact_type,
        platform=platform,
        is_installable=is_installable_artifact(artifact),
        build_configuration=(
            artifact.build_configuration.name if artifact.build_configuration else None
        ),
        app_icon_id=artifact.app_icon_id,
        apple_app_info=apple_app_info,
        android_app_info=android_app_info,
    )


def to_size_info(
    size_metrics: list[PreprodArtifactSizeMetrics],
    base_size_metrics: list[PreprodArtifactSizeMetrics] | None = None,
) -> None | SizeInfo:
    if len(size_metrics) == 0:
        return None

    main_metric = next(
        (
            metric
            for metric in size_metrics
            if metric.metrics_artifact_type
            == PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT
        ),
        # Fallback to the first metric if no main artifact is found
        size_metrics[0],
    )

    match main_metric.state:
        case PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING:
            return SizeInfoPending()
        case PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING:
            return SizeInfoProcessing()
        case PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED:
            max_install_size = main_metric.max_install_size
            max_download_size = main_metric.max_download_size
            if max_install_size is None or max_download_size is None:
                raise ValueError(
                    "COMPLETED state requires both max_install_size and max_download_size"
                )

            return SizeInfoCompleted(
                install_size_bytes=max_install_size,
                download_size_bytes=max_download_size,
                size_metrics=[
                    SizeInfoSizeMetric(
                        metrics_artifact_type=metric.metrics_artifact_type,
                        install_size_bytes=metric.max_install_size,
                        download_size_bytes=metric.max_download_size,
                    )
                    for metric in size_metrics
                ],
                base_size_metrics=[
                    SizeInfoSizeMetric(
                        metrics_artifact_type=metric.metrics_artifact_type,
                        install_size_bytes=metric.max_install_size,
                        download_size_bytes=metric.max_download_size,
                    )
                    for metric in (base_size_metrics or [])
                    if metric.max_install_size is not None and metric.max_download_size is not None
                ],
            )
        case PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED:
            error_code = main_metric.error_code
            error_message = main_metric.error_message
            if error_code is None or error_message is None:
                raise ValueError("FAILED state requires both error_code and error_message")
            return SizeInfoFailed(error_code=error_code, error_message=error_message)
        case _:
            raise ValueError(f"Unknown SizeAnalysisState {main_metric.state}")


def transform_preprod_artifact_to_build_details(
    artifact: PreprodArtifact,
) -> BuildDetailsApiResponse:

    size_metrics_list = list(artifact.preprodartifactsizemetrics_set.all())

    base_size_metrics_list: list[PreprodArtifactSizeMetrics] = []
    base_artifact = (
        artifact.get_base_artifact_for_commit().select_related("build_configuration").first()
    )
    base_build_info = None
    if base_artifact:
        base_size_metrics_qs = PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact=base_artifact,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )
        base_size_metrics_list = list(base_size_metrics_qs)
        base_build_info = create_build_details_app_info(base_artifact)

    size_info = to_size_info(size_metrics_list, base_size_metrics_list)

    app_info = create_build_details_app_info(artifact)

    vcs_info = BuildDetailsVcsInfo(
        head_sha=(artifact.commit_comparison.head_sha if artifact.commit_comparison else None),
        base_sha=(artifact.commit_comparison.base_sha if artifact.commit_comparison else None),
        provider=(artifact.commit_comparison.provider if artifact.commit_comparison else None),
        head_repo_name=(
            artifact.commit_comparison.head_repo_name if artifact.commit_comparison else None
        ),
        base_repo_name=(
            artifact.commit_comparison.base_repo_name if artifact.commit_comparison else None
        ),
        head_ref=(artifact.commit_comparison.head_ref if artifact.commit_comparison else None),
        base_ref=(artifact.commit_comparison.base_ref if artifact.commit_comparison else None),
        pr_number=(artifact.commit_comparison.pr_number if artifact.commit_comparison else None),
    )

    posted_status_checks = _parse_posted_status_checks(artifact)

    return BuildDetailsApiResponse(
        id=artifact.id,
        state=artifact.state,
        app_info=app_info,
        vcs_info=vcs_info,
        project_id=artifact.project.id,
        project_slug=artifact.project.slug,
        size_info=size_info,
        posted_status_checks=posted_status_checks,
        base_artifact_id=base_artifact.id if base_artifact else None,
        base_build_info=base_build_info,
    )


def _parse_posted_status_checks(artifact: PreprodArtifact) -> PostedStatusChecks | None:
    """Parse posted status checks from artifact extras, returning None for invalid data."""
    if not artifact.extras:
        return None

    raw_checks = artifact.extras.get("posted_status_checks")
    if not isinstance(raw_checks, dict):
        return None

    raw_size = raw_checks.get("size")
    if not isinstance(raw_size, dict):
        return None

    size_check: StatusCheckResult
    if raw_size.get("success") is True:
        size_check = _parse_success_check(raw_size, artifact.id)
    else:
        size_check = _parse_failure_check(raw_size, artifact.id)

    return PostedStatusChecks(size=size_check)


def _parse_success_check(raw_size: dict[str, Any], artifact_id: int) -> StatusCheckResultSuccess:
    """Parse a successful status check result."""
    check_id = raw_size.get("check_id")
    if check_id is not None and not isinstance(check_id, str):
        logger.warning(
            "preprod.build_details.invalid_check_id",
            extra={
                "artifact_id": artifact_id,
                "check_id_type": type(check_id).__name__,
            },
        )
        check_id = None
    return StatusCheckResultSuccess(check_id=check_id)


def _parse_failure_check(raw_size: dict[str, Any], artifact_id: int) -> StatusCheckResultFailure:
    """Parse a failed status check result."""
    error_type: StatusCheckErrorType | None = None
    error_type_str = raw_size.get("error_type")
    if error_type_str:
        try:
            error_type = StatusCheckErrorType(error_type_str)
        except ValueError:
            logger.warning(
                "preprod.build_details.invalid_error_type",
                extra={
                    "artifact_id": artifact_id,
                    "error_type": error_type_str,
                },
            )
    return StatusCheckResultFailure(error_type=error_type)
