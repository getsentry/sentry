from __future__ import annotations

from typing import Any, Literal, NotRequired, TypedDict

from sentry.preprod.models import PreprodArtifact


class AppInfoResponseDict(TypedDict):
    app_id: str | None
    name: str | None
    version: str | None
    build_number: int | None
    artifact_type: int | None
    date_added: str | None
    date_built: str | None


class GitInfoResponseDict(TypedDict):
    head_sha: str | None
    base_sha: str | None
    provider: str | None
    head_repo_name: str | None
    base_repo_name: str | None
    head_ref: str | None
    base_ref: str | None
    pr_number: int | None


class AppComponentResponseDict(TypedDict):
    component_type: int
    name: str
    app_id: str
    path: str
    download_size: int
    install_size: int


class DiffItemResponseDict(TypedDict):
    size_diff: int
    head_size: int | None
    base_size: int | None
    path: str
    item_type: str | None
    type: str
    diff_items: list[DiffItemResponseDict] | None


class SizeMetricDiffResponseDict(TypedDict):
    metrics_artifact_type: int
    identifier: str | None
    head_install_size: int
    head_download_size: int
    base_install_size: int
    base_download_size: int


class InsightDiffItemResponseDict(TypedDict):
    insight_type: str
    status: str
    total_savings_change: int
    file_diffs: list[DiffItemResponseDict]
    group_diffs: list[DiffItemResponseDict]


class ComparisonResponseDict(TypedDict):
    metrics_artifact_type: int
    identifier: str | None
    state: int
    error_code: NotRequired[str | None]
    error_message: NotRequired[str | None]
    diff_items: NotRequired[list[DiffItemResponseDict] | None]
    insight_diff_items: NotRequired[list[InsightDiffItemResponseDict] | None]
    size_metric_diff: NotRequired[SizeMetricDiffResponseDict | None]


class SizeAnalysisPendingResponseDict(TypedDict):
    build_id: str
    state: Literal["PENDING"]
    app_info: AppInfoResponseDict
    git_info: GitInfoResponseDict | None


class SizeAnalysisProcessingResponseDict(TypedDict):
    build_id: str
    state: Literal["PROCESSING"]
    app_info: AppInfoResponseDict
    git_info: GitInfoResponseDict | None


class SizeAnalysisFailedResponseDict(TypedDict):
    build_id: str
    state: Literal["FAILED"]
    app_info: AppInfoResponseDict
    git_info: GitInfoResponseDict | None
    error_code: int | None
    error_message: str | None


class SizeAnalysisNotRanResponseDict(TypedDict):
    build_id: str
    state: Literal["NOT_RAN"]
    app_info: AppInfoResponseDict
    git_info: GitInfoResponseDict | None
    error_code: int | None
    error_message: str | None


class SizeAnalysisCompletedResponseDict(TypedDict):
    build_id: str
    state: Literal["COMPLETED"]
    app_info: AppInfoResponseDict
    git_info: GitInfoResponseDict | None
    download_size: int
    install_size: int
    analysis_duration: float | None
    analysis_version: str | None
    insights: NotRequired[dict[str, Any] | None]
    app_components: NotRequired[list[AppComponentResponseDict] | None]
    base_build_id: NotRequired[str | None]
    base_app_info: NotRequired[AppInfoResponseDict | None]
    comparisons: NotRequired[list[ComparisonResponseDict] | None]


SizeAnalysisResponseDict = (
    SizeAnalysisPendingResponseDict
    | SizeAnalysisProcessingResponseDict
    | SizeAnalysisFailedResponseDict
    | SizeAnalysisNotRanResponseDict
    | SizeAnalysisCompletedResponseDict
)


def create_app_info_dict(artifact: PreprodArtifact) -> AppInfoResponseDict:
    mobile_app_info = getattr(artifact, "mobile_app_info", None)

    return AppInfoResponseDict(
        app_id=artifact.app_id,
        name=mobile_app_info.app_name if mobile_app_info else None,
        version=mobile_app_info.build_version if mobile_app_info else None,
        build_number=mobile_app_info.build_number if mobile_app_info else None,
        artifact_type=artifact.artifact_type,
        date_added=artifact.date_added.isoformat() if artifact.date_added else None,
        date_built=artifact.date_built.isoformat() if artifact.date_built else None,
    )


def create_git_info_dict(artifact: PreprodArtifact) -> GitInfoResponseDict | None:
    commit_comparison = getattr(artifact, "commit_comparison", None)
    if commit_comparison is None:
        return None

    return GitInfoResponseDict(
        head_sha=commit_comparison.head_sha,
        base_sha=commit_comparison.base_sha,
        provider=commit_comparison.provider,
        head_repo_name=commit_comparison.head_repo_name,
        base_repo_name=commit_comparison.base_repo_name,
        head_ref=commit_comparison.head_ref,
        base_ref=commit_comparison.base_ref,
        pr_number=commit_comparison.pr_number,
    )
