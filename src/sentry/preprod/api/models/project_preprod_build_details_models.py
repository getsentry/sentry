from __future__ import annotations

import logging
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, Field

from sentry.preprod.build_distribution_utils import is_installable_artifact
from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics

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
    size_info: SizeInfo | None = None


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


def to_size_info(size_metrics: list[PreprodArtifactSizeMetrics]) -> None | SizeInfo:
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

    size_metrics_qs = PreprodArtifactSizeMetrics.objects.filter(
        preprod_artifact=artifact,
    )

    size_info = to_size_info(list(size_metrics_qs))

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

    app_info = BuildDetailsAppInfo(
        app_id=artifact.app_id,
        name=artifact.app_name,
        version=artifact.build_version,
        build_number=artifact.build_number,
        date_added=(artifact.date_added.isoformat() if artifact.date_added else None),
        date_built=(artifact.date_built.isoformat() if artifact.date_built else None),
        artifact_type=artifact.artifact_type,
        platform=(
            platform_from_artifact_type(artifact.artifact_type)
            if artifact.artifact_type is not None
            else None
        ),
        is_installable=is_installable_artifact(artifact),
        build_configuration=(
            artifact.build_configuration.name if artifact.build_configuration else None
        ),
        apple_app_info=apple_app_info,
        android_app_info=android_app_info,
    )

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

    return BuildDetailsApiResponse(
        id=artifact.id,
        state=artifact.state,
        app_info=app_info,
        vcs_info=vcs_info,
        size_info=size_info,
    )
