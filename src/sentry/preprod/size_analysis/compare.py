from __future__ import annotations

import logging
from typing import NamedTuple

from packaging.version import InvalidVersion
from packaging.version import parse as parse_version

from sentry.preprod.models import PreprodArtifactSizeMetrics
from sentry.preprod.size_analysis.models import (
    ComparisonResults,
    DiffItem,
    DiffType,
    FileAnalysis,
    FileInfo,
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

    head_renamed_paths, base_renamed_paths = _find_renamed_paths(
        head_size_analysis_results.file_analysis,
        base_size_analysis_results.file_analysis,
    )

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

                # Skip if this is a renamed file (same hash exists in base at different path)
                if path in head_renamed_paths:
                    continue

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

                # Skip if this is a renamed file (same hash exists in head at different path)
                if path in base_renamed_paths:
                    continue

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


class MatchedElements(NamedTuple):
    """Result of matching treemap elements between head and base."""

    matched_pairs: list[tuple[TreemapElement, TreemapElement]]
    unmatched_head: list[TreemapElement]
    unmatched_base: list[TreemapElement]


def _match_elements(
    head_elements: list[TreemapElement], base_elements: list[TreemapElement]
) -> MatchedElements:
    """
    Intelligently match elements from head and base when there are duplicates.
    For example, in iOS processing multiple images can map to the same file name.

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

    return MatchedElements(matched_pairs, unmatched_head, unmatched_base)


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


def _find_renamed_paths(
    head_file_analysis: FileAnalysis | None,
    base_file_analysis: FileAnalysis | None,
) -> tuple[set[str], set[str]]:
    """Find paths that are likely renames (same hash, different path).

    When a file with the same hash exists at different paths in head vs base,
    we consider it a rename. However, if there are more paths on one side
    (e.g., file was renamed AND duplicated), we only mark min(head, base)
    as renames - the rest are true additions/removals.
    """
    head_hash_to_paths = _build_hash_to_paths(head_file_analysis)
    base_hash_to_paths = _build_hash_to_paths(base_file_analysis)

    head_renamed_paths: set[str] = set()
    base_renamed_paths: set[str] = set()

    for file_hash, head_paths in head_hash_to_paths.items():
        base_paths = base_hash_to_paths.get(file_hash, set())
        # Paths only in head (not in base) with the same hash as paths only in base
        head_only = head_paths - base_paths
        base_only = base_paths - head_paths

        if head_only and base_only:
            # Only mark the minimum count as renames - the rest are real adds/removes
            # e.g., 1 base path + 3 head paths = 1 rename + 2 additions
            rename_count = min(len(head_only), len(base_only))
            head_renamed_paths.update(sorted(head_only)[:rename_count])
            base_renamed_paths.update(sorted(base_only)[:rename_count])

    return head_renamed_paths, base_renamed_paths


def _build_hash_to_paths(file_analysis: FileAnalysis | None) -> dict[str, set[str]]:
    if not file_analysis:
        return {}

    hash_to_paths: dict[str, set[str]] = {}
    for file_info in file_analysis.items:
        _collect_file_hashes(file_info, hash_to_paths)
    return hash_to_paths


def _collect_file_hashes(
    file_info: FileInfo,
    hash_to_paths: dict[str, set[str]],
    parent_path: str = "",
) -> None:
    if parent_path and not file_info.path.startswith(f"{parent_path}/"):
        full_path = f"{parent_path}/{file_info.path}"
    else:
        full_path = file_info.path

    if not file_info.children:
        if file_info.hash not in hash_to_paths:
            hash_to_paths[file_info.hash] = set()
        hash_to_paths[file_info.hash].add(full_path)
    else:
        # Asset catalogs can have children
        for child in file_info.children:
            _collect_file_hashes(child, hash_to_paths, full_path)
