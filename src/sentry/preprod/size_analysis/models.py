from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, ConfigDict

from sentry.preprod.models import PreprodArtifactSizeMetrics
from sentry.preprod.size_analysis.insight_models import (
    AudioCompressionInsightResult,
    DuplicateFilesInsightResult,
    HermesDebugInfoInsightResult,
    ImageOptimizationInsightResult,
    LargeAudioFileInsightResult,
    LargeImageFileInsightResult,
    LargeVideoFileInsightResult,
    LocalizedStringCommentsInsightResult,
    LooseImagesInsightResult,
    MainBinaryExportMetadataResult,
    MultipleNativeLibraryArchInsightResult,
    SmallFilesInsightResult,
    StripBinaryInsightResult,
    UnnecessaryFilesInsightResult,
    VideoCompressionInsightResult,
    WebPOptimizationInsightResult,
)

###
# Size analysis results (non-comparison)
# Keep in sync with https://github.com/getsentry/launchpad/blob/main/src/launchpad/size/models/common.py#L92
###


class AndroidInsightResults(BaseModel):
    duplicate_files: DuplicateFilesInsightResult | None
    webp_optimization: WebPOptimizationInsightResult | None
    large_images: LargeImageFileInsightResult | None
    large_videos: LargeVideoFileInsightResult | None
    large_audio: LargeAudioFileInsightResult | None
    hermes_debug_info: HermesDebugInfoInsightResult | None
    multiple_native_library_archs: MultipleNativeLibraryArchInsightResult | None


class AppleInsightResults(BaseModel):
    duplicate_files: DuplicateFilesInsightResult | None
    large_images: LargeImageFileInsightResult | None
    large_audios: LargeAudioFileInsightResult | None
    large_videos: LargeVideoFileInsightResult | None
    strip_binary: StripBinaryInsightResult | None
    localized_strings_minify: LocalizedStringCommentsInsightResult | None
    small_files: SmallFilesInsightResult | None
    loose_images: LooseImagesInsightResult | None
    hermes_debug_info: HermesDebugInfoInsightResult | None
    image_optimization: ImageOptimizationInsightResult | None
    main_binary_exported_symbols: MainBinaryExportMetadataResult | None
    unnecessary_files: UnnecessaryFilesInsightResult | None
    audio_compression: AudioCompressionInsightResult | None
    video_compression: VideoCompressionInsightResult | None
    alternate_icons_optimization: ImageOptimizationInsightResult | None


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
    insights: AndroidInsightResults | AppleInsightResults | None
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
    diff_items: list[DiffItem] | None


class SizeMetricDiffItem(BaseModel):
    metrics_artifact_type: PreprodArtifactSizeMetrics.MetricsArtifactType
    identifier: str | None
    head_install_size: int
    head_download_size: int
    base_install_size: int
    base_download_size: int


class InsightDiffType(str, Enum):
    NEW = "new"
    RESOLVED = "resolved"
    UNRESOLVED = "unresolved"


class InsightDiffItem(BaseModel):
    insight_type: str
    status: InsightDiffType
    total_savings_change: int
    file_diffs: list[DiffItem]
    group_diffs: list[DiffItem]


class ComparisonResults(BaseModel):
    diff_items: list[DiffItem]
    insight_diff_items: list[InsightDiffItem]
    size_metric_diff_item: SizeMetricDiffItem
    skipped_diff_item_comparison: bool
    head_analysis_version: str | None
    base_analysis_version: str | None
