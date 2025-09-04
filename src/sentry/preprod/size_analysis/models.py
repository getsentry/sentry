from dataclasses import Field
from enum import Enum

from pydantic import ConfigDict

from sentry.db.models.base import BaseModel
from sentry.preprod.models import PreprodArtifactSizeMetrics

###
# Size analysis results (non-comparison)
###


class TreemapElement(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str = Field(..., description="Display name of the element")
    size: int = Field(..., ge=0, description="Install size in bytes")
    path: str | None = Field(None, description="Relative file or directory path")
    is_dir: bool = Field(False, description="Whether this element represents a directory")
    """ Some files (like zip files) are not directories but have children. """
    children: list["TreemapElement"] = Field(default_factory=list, description="Child elements")


class TreemapResults(BaseModel):
    """Complete treemap analysis results."""

    root: TreemapElement = Field(..., description="Root element of the treemap")
    file_count: int = Field(..., ge=0, description="Total number of files analyzed")
    category_breakdown: dict[str, dict[str, int]] = Field(
        default_factory=dict, description="Size breakdown by category"
    )
    platform: str = Field(default="unknown", description="Platform (ios, android, etc.)")


# Keep in sync with https://github.com/getsentry/launchpad/blob/main/src/launchpad/size/models/common.py#L92
class SizeAnalysisResults(BaseModel):
    download_size: int = Field(..., description="Estimated download size in bytes")
    install_size: int = Field(..., description="Estimated install size in bytes")
    treemap: TreemapResults | None = Field(..., description="Hierarchical size analysis treemap")


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
    size_diff: int = Field(..., description="Size diff")
    head_size: int | None = Field(None, description="Head node size if node is present in head")
    base_size: int | None = Field(None, description="Base node size if node is present in base")
    path: str = Field(..., description="Item path")
    type: DiffType = Field(..., description="Type of change")


class SizeMetricDiffItem(BaseModel):
    metrics_artifact_type: PreprodArtifactSizeMetrics.MetricsArtifactType = Field(
        ..., description=r"Artifact type \(main, watch, android dynamic feat\)"
    )
    identifier: str | None = Field(
        ...,
        description=r"Optional identifier used to discriminate between duplicate MetricsArtifactType \(e.g. Android dynamic feat\)",
    )
    head_install_size: int = Field(..., description="Overall install size of head artifact")
    head_download_size: int = Field(..., description="Overall download size of head artifact")
    base_install_size: int = Field(..., description="Overall install size of base artifact")
    base_download_size: int = Field(..., description="Overall download size of base artifact")


class ComparisonResults(BaseModel):
    diff_items: list[DiffItem] = Field(..., description="List of diff items")
    size_metric_diff_item: SizeMetricDiffItem = Field(..., description="Size metrics diff item")
