from __future__ import annotations

from typing import Any, Literal, NotRequired, TypedDict

from sentry.preprod.models import PreprodArtifact


class AppInfoResponseDict(TypedDict):
    app_id: str
    name: str | None
    version: str | None
    build_number: int | None
    artifact_type: int | None
    date_added: str
    date_built: str | None
    commit_sha: str | None


class SizeAnalysisPendingResponseDict(TypedDict):
    build_id: str
    state: Literal["PENDING"]
    app_info: AppInfoResponseDict


class SizeAnalysisProcessingResponseDict(TypedDict):
    build_id: str
    state: Literal["PROCESSING"]
    app_info: AppInfoResponseDict


class SizeAnalysisFailedResponseDict(TypedDict):
    build_id: str
    state: Literal["FAILED"]
    app_info: AppInfoResponseDict
    error_code: int | None
    error_message: str | None


class SizeAnalysisNotRanResponseDict(TypedDict):
    build_id: str
    state: Literal["NOT_RAN"]
    app_info: AppInfoResponseDict
    error_code: int | None
    error_message: str | None


class SizeAnalysisCompletedResponseDict(TypedDict):
    build_id: str
    state: Literal["COMPLETED"]
    app_info: AppInfoResponseDict
    download_size: int
    install_size: int
    analysis_duration: float | None
    analysis_version: str | None
    insights: NotRequired[dict[str, Any] | None]
    app_components: NotRequired[list[dict[str, Any]] | None]
    base_build_id: NotRequired[str | None]
    base_app_info: NotRequired[AppInfoResponseDict | None]
    comparisons: NotRequired[list[dict[str, Any]] | None]


SizeAnalysisResponseDict = (
    SizeAnalysisPendingResponseDict
    | SizeAnalysisProcessingResponseDict
    | SizeAnalysisFailedResponseDict
    | SizeAnalysisNotRanResponseDict
    | SizeAnalysisCompletedResponseDict
)


def create_app_info_dict(artifact: PreprodArtifact) -> AppInfoResponseDict:
    """Build an AppInfoResponseDict from a PreprodArtifact."""
    mobile_app_info = getattr(artifact, "mobile_app_info", None)
    commit_comparison = getattr(artifact, "commit_comparison", None)

    return AppInfoResponseDict(
        app_id=artifact.app_id,
        name=mobile_app_info.app_name if mobile_app_info else None,
        version=mobile_app_info.build_version if mobile_app_info else None,
        build_number=mobile_app_info.build_number if mobile_app_info else None,
        artifact_type=artifact.artifact_type,
        date_added=artifact.date_added.isoformat() if artifact.date_added else None,
        date_built=artifact.date_built.isoformat() if artifact.date_built else None,
        commit_sha=commit_comparison.head_sha if commit_comparison else None,
    )
