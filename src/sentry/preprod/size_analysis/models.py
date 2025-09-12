from enum import Enum

from pydantic import BaseModel, ConfigDict

from sentry.preprod.models import PreprodArtifactSizeMetrics

###
# Size analysis results (non-comparison)
###


# Keep in sync with https://github.com/getsentry/launchpad/blob/5dbe452bdd983dd45fad2f30f32890c0252a93bb/src/launchpad/size/models/treemap.py#L11
class TreemapType(str, Enum):
    """Types of elements in the treemap for visualization."""

    # Generic file categories (cross-platform)
    FILES = "files"
    EXECUTABLES = "executables"
    RESOURCES = "resources"
    ASSETS = "assets"
    MANIFESTS = "manifests"
    SIGNATURES = "signatures"
    FONTS = "fonts"

    # Apple-specific categories
    FRAMEWORKS = "frameworks"
    PLISTS = "plists"
    EXTENSIONS = "extensions"  # App extensions and plugins

    # Android-specific categories
    DEX = "dex"
    NATIVE_LIBRARIES = "native_libraries"
    COMPILED_RESOURCES = "compiled_resources"

    # Binary analysis categories (cross-platform)
    MODULES = "modules"
    CLASSES = "classes"
    METHODS = "methods"
    STRINGS = "strings"
    SYMBOLS = "symbols"

    # Apple binary categories
    DYLD = "dyld"
    MACHO = "macho"
    FUNCTION_STARTS = "function_starts"
    CODE_SIGNATURE = "code_signature"
    EXTERNAL_METHODS = "external_methods"

    # Binary section categories
    BINARY = "binary"

    # Generic categories
    OTHER = "other"
    UNMAPPED = "unmapped"


class TreemapElement(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    size: int
    path: str | None
    is_dir: bool
    type: TreemapType | None
    """ Some files (like zip files) are not directories but have children. """
    children: list["TreemapElement"]


class TreemapResults(BaseModel):
    """Complete treemap analysis results."""

    root: TreemapElement
    file_count: int
    category_breakdown: dict[str, dict[str, int]]
    platform: str


# Keep in sync with https://github.com/getsentry/launchpad/blob/main/src/launchpad/size/models/common.py#L92
class SizeAnalysisResults(BaseModel):
    download_size: int
    install_size: int
    treemap: TreemapResults | None


###
# Comparison results
###


class DiffType(str, Enum):
    ADDED = "added"
    REMOVED = "removed"
    INCREASED = "increased"
    DECREASED = "decreased"
    UNCHANGED = "unchanged"


class DiffItem(BaseModel):
    size_diff: int
    head_size: int | None
    base_size: int | None
    path: str
    item_type: TreemapType | None
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
