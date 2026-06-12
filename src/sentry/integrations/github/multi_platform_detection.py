from __future__ import annotations

import time
from collections import defaultdict
from typing import TYPE_CHECKING, Any, TypedDict

import sentry_sdk

from sentry.integrations.github.platform_registry import (
    _FRAMEWORKS_BY_PLATFORM,
    _NON_SELECTABLE_PLATFORMS,
    _PACKAGE_MANIFEST_FILES,
)
from sentry.integrations.github.platform_registry import (
    FRAMEWORKS as FRAMEWORKS,
)
from sentry.integrations.github.platform_registry import (
    GITHUB_LANGUAGE_TO_SENTRY_PLATFORM as GITHUB_LANGUAGE_TO_SENTRY_PLATFORM,
)
from sentry.integrations.github.platform_registry import (
    IGNORED_LANGUAGES as IGNORED_LANGUAGES,
)
from sentry.integrations.github.platform_registry import (
    DetectedPlatform as DetectedPlatform,
)
from sentry.integrations.github.platform_registry import (
    DetectorRule as DetectorRule,
)
from sentry.integrations.github.platform_registry import (
    FrameworkDef as FrameworkDef,
)
from sentry.integrations.github.platform_registry import (
    _apply_supersession as _apply_supersession,
)
from sentry.integrations.github.platform_registry import (
    _framework_matches as _framework_matches,
)
from sentry.integrations.github.platform_registry import (
    _package_in_manifest as _package_in_manifest,
)
from sentry.integrations.github.platform_registry import (
    _PackageManifest as _PackageManifest,
)
from sentry.integrations.github.platform_registry import (
    _rule_matches as _rule_matches,
)

if TYPE_CHECKING:
    from sentry.integrations.github.client import GitHubBaseClient

# ---------------------------------------------------------------------------
# Multi-platform detection constants
# ---------------------------------------------------------------------------

# Max number of languages (by byte count) to evaluate in a single detection
# run. Fixed at 3 for this pass; revisit once we have a few days of
# languages_count / k_reads_needed metrics.
MAX_LANGUAGES = 3

# Sort key weight for confidence tier: high > medium > low.
# Ensures a framework match (high) always ranks above a bare-language fallback
# (medium) regardless of byte count.
_CONFIDENCE_ORDER: dict[str, int] = {"high": 2, "medium": 1, "low": 0}

# Metric namespace — shared with the measurement endpoint so all multi-detector
# signals land in the same namespace.
_MULTI_METRICS_PREFIX = "onboarding-scm.platform_detection.multi"


def _count_language_groups(languages: dict[str, int]) -> int:
    """Count the distinct mapped Sentry base platforms across a repo's languages.

    SDK-less languages are ignored and related languages collapse to a single
    base platform (e.g. TypeScript + JavaScript -> javascript).
    """
    groups: set[str] = set()
    for language in languages:
        if language in IGNORED_LANGUAGES:
            continue
        bp = GITHUB_LANGUAGE_TO_SENTRY_PLATFORM.get(language)
        if bp is not None:
            groups.add(bp)
    return len(groups)


def _select_active_platforms(
    languages: dict[str, int],
) -> dict[str, list[tuple[str, int]]]:
    """Return the top-N mapped base platforms sorted by byte count descending.

    Multiple GitHub languages can map to the same Sentry base platform
    (e.g. TypeScript + JavaScript → javascript). When that happens both
    contribute to the same bucket.
    """
    active_platforms: dict[str, list[tuple[str, int]]] = defaultdict(list)
    count = 0
    for language, byte_count in sorted(languages.items(), key=lambda x: x[1], reverse=True):
        if language in IGNORED_LANGUAGES:
            continue
        base_platform = GITHUB_LANGUAGE_TO_SENTRY_PLATFORM.get(language)
        if base_platform is not None:
            if base_platform not in active_platforms:
                # Only count new base platforms toward the cap; related
                # languages (e.g. TS after JS) are grouped for free.
                count += 1
                if count > MAX_LANGUAGES:
                    continue
            active_platforms[base_platform].append((language, byte_count))
    return dict(active_platforms)


# ---------------------------------------------------------------------------
# Noise-scoping ignore-list for recursive tree traversal
#
# Based on GitHub Linguist's vendor.yml (https://github.com/github/linguist/
# blob/master/lib/linguist/vendor.yml) — the list GitHub uses to exclude
# third-party/generated paths from repository language statistics. Sentry has
# no canonical equivalent; the closest is the JS stacktrace folder regex in
# sentry/src/sentry/lang/javascript/utils.py.
#
# Matching is done on individual path segments (split on "/"), not substring,
# so a file named "build.gradle" is never confused with a "build/" directory.
#
# Deliberately NOT ignored:
#   packages/   — JS monorepo workspaces (the thing we want to detect)
#   test/       — often contain real framework signals
#   tests/      — same
#   examples/   — borderline; revisit if Mode A shows false positives
# ---------------------------------------------------------------------------

_IGNORED_TREE_SEGMENTS = frozenset(
    {
        # JS / front-end dependency directories
        "node_modules",
        "bower_components",
        "jspm_packages",
        "web_modules",
        # General vendored dependencies
        "vendor",
        "vendors",
        "third_party",
        "third-party",
        "3rdparty",
        "extern",
        "external",
        # iOS / macOS dependency managers
        "Pods",
        "Carthage",
        # Dart / Flutter tooling
        ".dart_tool",
        ".pub-cache",
        # Python virtual environments committed to repo
        "site-packages",
        ".venv",
        "venv",
        "virtualenv",
        # Build / compiled output
        "dist",
        "build",
        "out",
        "target",
        "bin",
        "obj",
        # Framework-specific build caches
        ".next",
        ".nuxt",
        ".svelte-kit",
        ".angular",
        ".output",
        "__pycache__",
        "coverage",
        # VCS internals
        ".git",
        ".svn",
        ".hg",
        # Tooling / IDE / cache
        ".gradle",
        ".idea",
        ".vscode",
        ".cache",
        ".tox",
        ".mypy_cache",
        ".pytest_cache",
        "tmp",
        "temp",
    }
)


def _path_is_ignored(path: str) -> bool:
    """Return True if any segment of the path is in the ignore-list."""
    return any(segment in _IGNORED_TREE_SEGMENTS for segment in path.split("/"))


def _get_tree(
    client: GitHubBaseClient,
    repo: str,
    ref: str | None = None,
) -> tuple[list[dict[str, Any]], bool]:
    """Fetch the full recursive git tree for a repo.

    Uses raw client.get() rather than client.get_tree() so that the
    ``truncated`` flag and per-entry ``size`` fields are preserved.
    Returns (entries, is_truncated).
    """
    response = client.get(
        f"/repos/{repo}/git/trees/{ref or 'HEAD'}",
        params={"recursive": 1},
    )
    if not isinstance(response, dict):
        return [], False
    entries: list[dict[str, Any]] = response.get("tree", []) or []
    is_truncated = bool(response.get("truncated"))
    return entries, is_truncated


class _TreeIndex:
    """Indexed view of a repository's recursive git tree."""

    def __init__(
        self,
        dirs: set[str],
        full_paths_by_basename: dict[str, set[str]],
        full_repo_size_bytes: int,
    ) -> None:
        self.dirs = dirs
        # Maps basename → all non-ignored full paths with that name.
        self.full_paths_by_basename = full_paths_by_basename
        # Sum of ALL blobs including vendored/build dirs — the true tarball
        # weight.
        self.full_repo_size_bytes = full_repo_size_bytes

    @property
    def files(self) -> set[str]:
        return set(self.full_paths_by_basename.keys())


def _build_tree_index(entries: list[dict[str, Any]]) -> _TreeIndex:
    """Build a searchable index from raw git tree entries.

    Blobs (files) and trees (directories) are indexed by their basename.
    Any entry whose path passes through an ignored segment is skipped, so
    ``node_modules/some-lib/package.json`` never contributes a false signal.
    ``full_repo_size_bytes`` is the sum of ``size`` across all blobs.
    """
    dirs: set[str] = set()
    full_paths_by_basename: dict[str, set[str]] = defaultdict(set)
    full_repo_size_bytes = 0

    for entry in entries:
        path = entry.get("path", "")
        size = entry.get("size") or 0

        if entry.get("type") == "blob":
            full_repo_size_bytes += size

        if not path or _path_is_ignored(path):
            continue

        entry_type = entry.get("type")
        basename = path.rsplit("/", 1)[-1]

        if entry_type == "blob":
            full_paths_by_basename[basename].add(path)
        elif entry_type == "tree":
            dirs.add(basename)

    return _TreeIndex(
        dirs=dirs,
        full_paths_by_basename=dict(full_paths_by_basename),
        full_repo_size_bytes=full_repo_size_bytes,
    )


class MultiDetectionResult(TypedDict):
    """Return value of detect_platforms_multi.

    ``platforms`` is the product output — what a future live endpoint surfaces.
    The remaining fields are measurement scaffolding (temporary): they feed the
    Mode A harness and drive the Sentry metrics that size K_candidate thresholds
    and truncation rates. Remove them once those thresholds are set and the
    measurement-only endpoint is retired (see multiPlatformPlan.md).
    """

    platforms: list[DetectedPlatform]
    k_candidate: int  # how many content-reads would be needed to resolve content/package rules
    needed_paths: set[str]  # the actual filenames (measurement scaffolding)
    tree_entry_count: int  # total entries returned by GitHub
    is_truncated: bool  # GitHub truncated the tree at 100k entries / 7MB
    full_repo_size_bytes: int  # sum of ALL blob sizes including vendored/build dirs


def _collect_needed_paths(
    active_platforms: dict[str, list[tuple[str, int]]],
    full_paths_by_basename: dict[str, set[str]],
) -> set[str]:
    """Collect the full file paths that content/package rules would need to fetch.

    For each active base platform:
    - If a package manifest exists in the tree, include ALL its full paths
      (covers match_package rules; a monorepo may have one per workspace).
    - For every framework rule that has match_content, include all full paths
      for the target basename if it exists in the tree. For match_ext rules
      with match_content, include all full paths for every matching-extension
      file found in the tree.

    The ignore-list is already applied upstream, so no extra filtering is needed.
    """
    needed: set[str] = set()

    for base_platform in active_platforms:
        # Package manifest for match_package rules
        manifest_file = _PACKAGE_MANIFEST_FILES.get(base_platform)
        if manifest_file and manifest_file in full_paths_by_basename:
            needed.update(full_paths_by_basename[manifest_file])

        # Files required by match_content rules
        for fw in _FRAMEWORKS_BY_PLATFORM.get(base_platform, []):
            for rule in [*fw.get("every", []), *fw.get("some", [])]:
                if "match_content" not in rule:
                    continue
                path = rule.get("path")
                if path:
                    if path in full_paths_by_basename:
                        needed.update(full_paths_by_basename[path])
                elif "match_ext" in rule:
                    ext = rule["match_ext"]
                    for basename, paths in full_paths_by_basename.items():
                        if basename.endswith(ext):
                            needed.update(paths)

    return needed


def detect_platforms_multi(
    client: GitHubBaseClient,
    repo: str,
    ref: str | None = None,
) -> MultiDetectionResult:
    """Detect Sentry platforms for a GitHub repository.

    Selects up to MAX_LANGUAGES base platforms by byte count, fetches the
    full recursive git tree once, and evaluates existence rules (path /
    match_dir / match_ext) across all paths — subdir-aware with no extra API
    calls. Content/package rules (match_content / match_package) are not
    evaluated here; the paths they would need are counted as k_reads_needed
    without fetching them.

    The return value feeds the Mode A harness and (eventually) the live
    detection endpoint.
    """
    start_time = time.monotonic()

    languages: dict[str, int] = client.get_languages(repo)
    active_platforms = _select_active_platforms(languages)

    entries, is_truncated = _get_tree(client, repo, ref)
    index = _build_tree_index(entries)

    results: list[DetectedPlatform] = []
    seen_platforms: set[str] = set()

    for base_platform, lang_entries in active_platforms.items():
        # Use the dominant language as the label, but sum all bytes in the
        # bucket so the sort reflects the platform's true weight (e.g. TS +
        # JS combined, not just the larger of the two).
        language = max(lang_entries, key=lambda x: x[1])[0]
        byte_count = sum(b for _, b in lang_entries)

        for fw in _FRAMEWORKS_BY_PLATFORM.get(base_platform, []):
            # Pass empty file_contents and no manifest so only path/dir/ext
            # existence rules fire; content/package rules return False here.
            if _framework_matches(fw, index.files, {}, None, index.dirs):
                platform_id = fw["platform"]
                if platform_id not in seen_platforms:
                    seen_platforms.add(platform_id)
                    results.append(
                        DetectedPlatform(
                            platform=platform_id,
                            language=language,
                            bytes=byte_count,
                            confidence="high",
                            priority=100 - fw["sort"],
                        )
                    )

        if base_platform not in seen_platforms:
            seen_platforms.add(base_platform)
            results.append(
                DetectedPlatform(
                    platform=base_platform,
                    language=language,
                    bytes=byte_count,
                    confidence="medium",
                    priority=1,
                )
            )

    results = _apply_supersession(results)
    results = [r for r in results if r["platform"] not in _NON_SELECTABLE_PLATFORMS]
    results.sort(
        key=lambda r: (_CONFIDENCE_ORDER[r["confidence"]], r["bytes"], r["priority"]),
        reverse=True,
    )

    needed_paths = _collect_needed_paths(active_platforms, index.full_paths_by_basename)

    sentry_sdk.metrics.distribution(
        f"{_MULTI_METRICS_PREFIX}.duration",
        (time.monotonic() - start_time) * 1000,
        unit="millisecond",
    )
    sentry_sdk.metrics.distribution(
        f"{_MULTI_METRICS_PREFIX}.tree.entry_count",
        len(entries),
    )
    sentry_sdk.metrics.distribution(
        f"{_MULTI_METRICS_PREFIX}.full_repo_size_bytes",
        index.full_repo_size_bytes,
        unit="byte",
    )
    sentry_sdk.metrics.distribution(
        f"{_MULTI_METRICS_PREFIX}.languages_count",
        _count_language_groups(languages),
    )
    sentry_sdk.metrics.distribution(
        f"{_MULTI_METRICS_PREFIX}.detected_platforms_count",
        len(results),
    )
    sentry_sdk.metrics.distribution(
        f"{_MULTI_METRICS_PREFIX}.k_reads_needed",
        len(needed_paths),
    )
    sentry_sdk.metrics.count(
        f"{_MULTI_METRICS_PREFIX}.completed",
        1,
        attributes={
            "is_truncated": is_truncated,
            "confidence": results[0]["confidence"] if results else "none",
            "has_framework": any(r["confidence"] == "high" for r in results),
        },
    )

    return MultiDetectionResult(
        platforms=results,
        k_candidate=len(needed_paths),
        needed_paths=needed_paths,
        tree_entry_count=len(entries),
        is_truncated=is_truncated,
        full_repo_size_bytes=index.full_repo_size_bytes,
    )
