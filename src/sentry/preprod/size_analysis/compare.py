from __future__ import annotations
from typing import int

import logging

from packaging.version import InvalidVersion
from packaging.version import parse as parse_version

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


def compare_size_analysis(
    head_size_analysis: PreprodArtifactSizeMetrics,
    head_size_analysis_results: SizeAnalysisResults,
    base_size_analysis: PreprodArtifactSizeMetrics,
    base_size_analysis_results: SizeAnalysisResults,
) -> ComparisonResults:
    skip_diff_item_comparison = _should_skip_diff_item_comparison(
        head_size_analysis_results, base_size_analysis_results
    )

    head_treemap = (
        head_size_analysis_results.treemap.root if head_size_analysis_results.treemap else None
    )
    base_treemap = (
        base_size_analysis_results.treemap.root if base_size_analysis_results.treemap else None
    )

    head_files = _flatten_leaf_nodes(head_treemap) if head_treemap else {}
    base_files = _flatten_leaf_nodes(base_treemap) if base_treemap else {}

    all_paths = set(head_files.keys()) | set(base_files.keys())

    diff_items = []

    if not skip_diff_item_comparison:
        for path in sorted(all_paths):
            head_elements = head_files.get(path, [])
            base_elements = base_files.get(path, [])

            matched_pairs, unmatched_head, unmatched_base = _match_elements(
                head_elements, base_elements
            )

            # Process matched pairs (modified or unchanged)
            for head_element, base_element in matched_pairs:
                head_size = head_element.size
                base_size = base_element.size
                size_diff = head_size - base_size

                if size_diff == 0:
                    continue  # Skip items with no size change

                item_type = head_element.type
                diff_type = DiffType.INCREASED if size_diff > 0 else DiffType.DECREASED

                diff_items.append(
                    DiffItem(
                        size_diff=size_diff,
                        head_size=head_size,
                        base_size=base_size,
                        path=path,
                        item_type=item_type,
                        type=diff_type,
                    )
                )

            # Process unmatched head elements (added)
            for head_element in unmatched_head:
                head_size = head_element.size
                if head_size == 0:
                    continue

                diff_items.append(
                    DiffItem(
                        size_diff=head_size,
                        head_size=head_size,
                        base_size=None,
                        path=path,
                        item_type=head_element.type,
                        type=DiffType.ADDED,
                    )
                )

            # Process unmatched base elements (removed)
            for base_element in unmatched_base:
                base_size = base_element.size
                if base_size == 0:
                    continue

                diff_items.append(
                    DiffItem(
                        size_diff=-base_size,
                        head_size=None,
                        base_size=base_size,
                        path=path,
                        item_type=base_element.type,
                        type=DiffType.REMOVED,
                    )
                )
    else:
        logger.info(
            "preprod.size_analysis.compare.skipped_diff_item_comparison",
            extra={
                "head_analysis_version": head_size_analysis_results.analysis_version,
                "base_analysis_version": base_size_analysis_results.analysis_version,
                "preprod_artifact_id": head_size_analysis.preprod_artifact_id,
            },
        )

    size_metric_diff_item = SizeMetricDiffItem(
        metrics_artifact_type=head_size_analysis.metrics_artifact_type,
        identifier=head_size_analysis.identifier,
        head_install_size=head_size_analysis.max_install_size,
        head_download_size=head_size_analysis.max_download_size,
        base_install_size=base_size_analysis.max_install_size,
        base_download_size=base_size_analysis.max_download_size,
    )

    return ComparisonResults(
        diff_items=diff_items,
        size_metric_diff_item=size_metric_diff_item,
        skipped_diff_item_comparison=skip_diff_item_comparison,
        head_analysis_version=head_size_analysis_results.analysis_version,
        base_analysis_version=base_size_analysis_results.analysis_version,
    )


def _should_skip_diff_item_comparison(
    head_size_analysis_results: SizeAnalysisResults,
    base_size_analysis_results: SizeAnalysisResults,
) -> bool:
    head_version = None
    base_version = None

    if head_size_analysis_results.analysis_version:
        try:
            head_version = parse_version(head_size_analysis_results.analysis_version)
        except InvalidVersion:
            logger.warning(
                "preprod.size_analysis.compare.invalid_version_format",
                extra={
                    "analysis_version": head_size_analysis_results.analysis_version,
                },
            )

    if base_size_analysis_results.analysis_version:
        try:
            base_version = parse_version(base_size_analysis_results.analysis_version)
        except InvalidVersion:
            logger.warning(
                "preprod.size_analysis.compare.invalid_version_format",
                extra={
                    "analysis_version": base_size_analysis_results.analysis_version,
                },
            )

    if not head_version or not base_version:
        return False

    has_mismatched_major = head_version.major != base_version.major
    has_mismatched_minor = head_version.minor != base_version.minor

    return has_mismatched_major or has_mismatched_minor


def _match_elements(
    head_elements: list[TreemapElement], base_elements: list[TreemapElement]
) -> tuple[list[tuple[TreemapElement, TreemapElement]], list[TreemapElement], list[TreemapElement]]:
    """
    Intelligently match elements from head and base when there are duplicates.
    For example, in iOS processing multiple images can map to the same file name.
    Returns: (matched_pairs, unmatched_head, unmatched_base)

    Matching strategy:
    1. First, match by exact name and size
    2. Then, match remaining by name only (for size changes)
    3. Remaining are added/removed
    """
    matched_pairs = []
    matched_head_indices = set()
    matched_base_indices = set()

    # Phase 1: Match by name and size (exact matches)
    for head_idx, head_elem in enumerate(head_elements):
        if head_idx in matched_head_indices:
            continue
        for base_idx, base_elem in enumerate(base_elements):
            if base_idx in matched_base_indices:
                continue
            if head_elem.name == base_elem.name and head_elem.size == base_elem.size:
                matched_pairs.append((head_elem, base_elem))
                matched_head_indices.add(head_idx)
                matched_base_indices.add(base_idx)
                break

    # Phase 2: Match by name only (for modified files)
    for head_idx, head_elem in enumerate(head_elements):
        if head_idx in matched_head_indices:
            continue
        for base_idx, base_elem in enumerate(base_elements):
            if base_idx in matched_base_indices:
                continue
            if head_elem.name == base_elem.name:
                matched_pairs.append((head_elem, base_elem))
                matched_head_indices.add(head_idx)
                matched_base_indices.add(base_idx)
                break

    # Collect unmatched elements for added/removed items
    unmatched_head = [
        elem for idx, elem in enumerate(head_elements) if idx not in matched_head_indices
    ]
    unmatched_base = [
        elem for idx, elem in enumerate(base_elements) if idx not in matched_base_indices
    ]

    return matched_pairs, unmatched_head, unmatched_base


def _flatten_leaf_nodes(
    element: TreemapElement, parent_path: str = ""
) -> dict[str, list[TreemapElement]]:
    items: dict[str, list[TreemapElement]] = {}

    path = element.path or (parent_path + "/" + element.name if parent_path else element.name)

    if not element.children or len(element.children) == 0:
        # Only add leaf nodes, store as list to handle duplicates
        if path not in items:
            items[path] = []
        items[path].append(element)
    else:
        for child in element.children:
            child_items = _flatten_leaf_nodes(child, path)
            for child_path, child_elements in child_items.items():
                if child_path not in items:
                    items[child_path] = []
                items[child_path].extend(child_elements)

    return items
