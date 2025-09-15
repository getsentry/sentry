import logging
from enum import StrEnum

from pydantic import BaseModel

from sentry.preprod.build_distribution_utils import is_installable_artifact
from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics

logger = logging.getLogger(__name__)


class Platform(StrEnum):
    IOS = "ios"
    ANDROID = "android"
    MACOS = "macos"


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
    # build_configuration: Optional[str] = None  # Uncomment when available
    # icon: Optional[str] = None  # Uncomment when available


class BuildDetailsVcsInfo(BaseModel):
    head_sha: str | None = None
    base_sha: str | None = None
    provider: str | None = None
    head_repo_name: str | None = None
    base_repo_name: str | None = None
    head_ref: str | None = None
    base_ref: str | None = None
    pr_number: int | None = None


class BuildDetailsSizeInfo(BaseModel):
    install_size_bytes: int
    download_size_bytes: int


class BuildDetailsApiResponse(BaseModel):
    id: str
    state: PreprodArtifact.ArtifactState
    size_analysis_state: PreprodArtifactSizeMetrics.SizeAnalysisState | None = None
    app_info: BuildDetailsAppInfo
    vcs_info: BuildDetailsVcsInfo
    size_info: BuildDetailsSizeInfo | None = None


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


def transform_preprod_artifact_to_build_details(
    artifact: PreprodArtifact,
) -> BuildDetailsApiResponse:
    size_info = None
    size_metrics = None
    try:
        size_metrics = PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        ).first()

        if size_metrics and size_metrics.max_install_size and size_metrics.max_download_size:
            size_info = BuildDetailsSizeInfo(
                install_size_bytes=size_metrics.max_install_size,
                download_size_bytes=size_metrics.max_download_size,
            )
    except Exception:
        logger.debug("Failed to get size metrics for artifact %s", artifact.id)

    app_info = BuildDetailsAppInfo(
        app_id=artifact.app_id,
        name=artifact.app_name,
        version=artifact.build_version,
        build_number=artifact.build_number,
        date_added=(artifact.date_added.isoformat() if artifact.date_added else None),
        date_built=(artifact.date_built.isoformat() if artifact.date_built else None),
        artifact_type=artifact.artifact_type,
        platform=(
            platform_from_artifact_type(artifact.artifact_type) if artifact.artifact_type else None
        ),
        is_installable=is_installable_artifact(artifact),
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
        size_analysis_state=size_metrics.state if size_metrics else None,
        app_info=app_info,
        vcs_info=vcs_info,
        size_info=size_info,
    )
