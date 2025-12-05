from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, ConfigDict

from sentry.preprod.models import PreprodArtifactSizeMetrics

###
# Size analysis results (non-comparison)
# Keep in sync with https://github.com/getsentry/launchpad/blob/main/src/launchpad/size/models/common.py#L92
###


class TreemapElement(BaseModel):

    model_config = ConfigDict(frozen=True)

    name: str
    size: int
    path: str | None
    is_dir: bool
    type: str | None
    """ Some files (like zip files) are not directories but have children. """
    children: list[TreemapElement]


class TreemapResults(BaseModel):
    """Complete treemap analysis results."""

    model_config = ConfigDict(frozen=True)

    root: TreemapElement
    file_count: int
    category_breakdown: dict[str, dict[str, int]]
    platform: str


class FileInfo(BaseModel):
    """Slim file info for rename detection.

    Only contains fields needed for hash-based rename detection.
    Other fields (size, file_type, etc.) are available in the treemap.
    """

    model_config = ConfigDict(frozen=True)

    path: str
    hash: str
    children: list[FileInfo] = []


class FileAnalysis(BaseModel):
    """Analysis results for files and directories in the app bundle."""

    model_config = ConfigDict(frozen=True)

    items: list[FileInfo]


class AppComponent(BaseModel):
    """Information about a modular app component (watch app, app extension, dynamic feature, etc.)."""

    model_config = ConfigDict(frozen=True)

    component_type: PreprodArtifactSizeMetrics.MetricsArtifactType
    name: str
    app_id: str
    path: str
    download_size: int
    install_size: int


class SizeAnalysisResults(BaseModel):

    model_config = ConfigDict(frozen=True)

    analysis_duration: float
    download_size: int
    install_size: int
    treemap: TreemapResults | None = None
    analysis_version: str | None = None
    file_analysis: FileAnalysis | None = None
    app_components: list[AppComponent] | None = None


###
# Comparison results
###


class DiffType(str, Enum):
    ADDED = "added"
    REMOVED = "removed"
    INCREASED = "increased"
    DECREASED = "decreased"


class DiffItem(BaseModel):
    size_diff: int
    head_size: int | None
    base_size: int | None
    path: str
    item_type: str | None
    type: DiffType


class SizeMetricDiffItem(BaseModel):
    metrics_artifact_type: PreprodArtifactSizeMetrics.MetricsArtifactType
    identifier: str | None
    head_install_size: int
    head_download_size: int
    base_install_size: int
    base_download_size: int


class ComparisonResults(BaseModel):
    diff_items: list[DiffItem]
    size_metric_diff_item: SizeMetricDiffItem
    skipped_diff_item_comparison: bool
    head_analysis_version: str | None
    base_analysis_version: str | None
