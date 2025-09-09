import logging

from sentry.preprod.models import PreprodArtifactSizeMetrics
from sentry.preprod.size_analysis.models import (
    ComparisonResults,
    DiffItem,
    DiffType,
    SizeAnalysisResults,
    SizeMetricDiffItem,
    TreemapElement,
)

logger = logging.getLogger(__name__)


def _flatten_leaf_nodes(element: TreemapElement, parent_path: str = "") -> dict[str, int]:
    items = {}

    path = element.path or (parent_path + "/" + element.name if parent_path else element.name)
    children = getattr(element, "children", [])

    if not children:
        # Only add leaf nodes
        items[path] = element.size
    else:
        for child in children:
            items.update(_flatten_leaf_nodes(child, path))

    return items


def compare_size_analysis(
    head_size_analysis: PreprodArtifactSizeMetrics,
    head_size_analysis_results: SizeAnalysisResults,
    base_size_analysis: PreprodArtifactSizeMetrics,
    base_size_analysis_results: SizeAnalysisResults,
) -> ComparisonResults:
    diff_items = []

    head_treemap = (
        head_size_analysis_results.treemap.root if head_size_analysis_results.treemap else None
    )
    base_treemap = (
        base_size_analysis_results.treemap.root if base_size_analysis_results.treemap else None
    )

    head_files = _flatten_leaf_nodes(head_treemap) if head_treemap else {}
    base_files = _flatten_leaf_nodes(base_treemap) if base_treemap else {}

    all_paths = set(head_files.keys()) | set(base_files.keys())

    for path in sorted(all_paths):
        head_size = head_files.get(path)
        base_size = base_files.get(path)
        if head_size is not None and base_size is not None:
            size_diff = head_size - base_size
            if size_diff == 0:
                continue  # Skip diff_items with size_diff of 0
            elif size_diff > 0:
                diff_type = DiffType.INCREASED
            else:
                diff_type = DiffType.DECREASED
        elif head_size is not None:
            size_diff = head_size
            if size_diff == 0:
                continue  # Skip diff_items with size_diff of 0
            diff_type = DiffType.ADDED
        elif base_size is not None:
            size_diff = 0 - base_size
            if size_diff == 0:
                continue  # Skip diff_items with size_diff of 0
            diff_type = DiffType.REMOVED

        diff_items.append(
            DiffItem(
                size_diff=size_diff,
                head_size=head_size,
                base_size=base_size,
                path=path,
                type=diff_type,
            )
        )

    size_metric_diff_item = SizeMetricDiffItem(
        metrics_artifact_type=getattr(
            head_size_analysis,
            "metrics_artifact_type",
            PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        ),
        identifier=head_size_analysis.identifier,
        head_install_size=head_size_analysis.max_install_size,
        head_download_size=head_size_analysis.max_download_size,
        base_install_size=base_size_analysis.max_install_size,
        base_download_size=base_size_analysis.max_download_size,
    )

    return ComparisonResults(
        diff_items=diff_items,
        size_metric_diff_item=size_metric_diff_item,
    )
