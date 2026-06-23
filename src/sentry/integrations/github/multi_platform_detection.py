from __future__ import annotations

import re
import time
from collections import defaultdict
from typing import TYPE_CHECKING, Any, TypedDict

import sentry_sdk

from sentry.integrations.github.platform_detection import (
    _get_repo_file_content,
    _parse_package_manifest,
)
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
    _package_in_manifest as _package_in_manifest,
)
from sentry.integrations.github.platform_registry import (
    _PackageManifest as _PackageManifest,
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

# Maximum number of per-file REST reads performed.
# Sized at p99 of k_candidate from the measurement run (≈5 reads covers the
# vast majority of repos while keeping the per-detection API footprint small).
MAX_CONTENT_READS = 5

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
        files_full_paths_by_basename: dict[str, set[str]],
        dirs_full_paths_by_basename: dict[str, set[str]],
        full_repo_size_bytes: int,
    ) -> None:
        # basename → set of all non-ignored full file paths with that name.
        self.files_full_paths_by_basename = files_full_paths_by_basename
        # basename → set of all non-ignored full directory paths with that name.
        self.dirs_full_paths_by_basename = dirs_full_paths_by_basename
        # Sum of ALL blobs including vendored/build dirs — the true tarball
        # weight.
        self.full_repo_size_bytes = full_repo_size_bytes


def _build_tree_index(entries: list[dict[str, Any]]) -> _TreeIndex:
    """Build a searchable index from raw git tree entries.

    Blobs (files) and trees (directories) are indexed by their basename.
    Any entry whose path passes through an ignored segment is skipped, so
    ``node_modules/some-lib/package.json`` never contributes a false signal.
    ``full_repo_size_bytes`` is the sum of ``size`` across all blobs.
    """
    files_full_paths_by_basename: dict[str, set[str]] = defaultdict(set)
    dirs_full_paths_by_basename: dict[str, set[str]] = defaultdict(set)
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
            files_full_paths_by_basename[basename].add(path)
        elif entry_type == "tree":
            dirs_full_paths_by_basename[basename].add(path)

    return _TreeIndex(
        files_full_paths_by_basename=dict(files_full_paths_by_basename),
        dirs_full_paths_by_basename=dict(dirs_full_paths_by_basename),
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
    k_candidate: int  # distinct content/package paths the full rule set would need
    k_reads_realized: (
        int  # files actually fetched in the content pass (capped at MAX_CONTENT_READS)
    )
    tree_entry_count: int  # total entries returned by GitHub
    is_truncated: bool  # GitHub truncated the tree at 100k entries / 7MB


def _collect_needed_paths(
    active_platforms: dict[str, list[tuple[str, int]]],
    files_full_paths_by_basename: dict[str, set[str]],
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
        if manifest_file and manifest_file in files_full_paths_by_basename:
            needed.update(files_full_paths_by_basename[manifest_file])

        # Files required by match_content rules
        for fw in _FRAMEWORKS_BY_PLATFORM.get(base_platform, []):
            for rule in [*fw.get("every", []), *fw.get("some", [])]:
                if "match_content" not in rule:
                    continue
                path = rule.get("path")
                if path:
                    if path in files_full_paths_by_basename:
                        needed.update(files_full_paths_by_basename[path])
                elif "match_ext" in rule:
                    ext = rule["match_ext"]
                    for basename, paths in files_full_paths_by_basename.items():
                        if basename.endswith(ext):
                            needed.update(paths)

    return needed


def _parent_dir(full_path: str) -> str:
    """Return the parent directory of a full path ('' = repo root)."""
    return full_path.rsplit("/", 1)[0] if "/" in full_path else ""


def _rule_parent_dirs(
    rule: DetectorRule,
    files_full_paths_by_basename: dict[str, set[str]],
    dirs_full_paths_by_basename: dict[str, set[str]],
    content_by_path: dict[str, str],
    manifests_by_path: dict[str, _PackageManifest],
) -> set[str]:
    """Collect parent directories where this rule is satisfiable.

    Works for all rule types i.e. existence-only, content, and package.
    """
    if "match_package" in rule:
        return {
            _parent_dir(path)
            for path, manifest in manifests_by_path.items()
            if _package_in_manifest(rule["match_package"], manifest)
        }

    if "match_content" in rule:
        pattern = rule["match_content"]
        path_filter = rule.get("path")
        ext_filter = rule.get("match_ext")
        result: set[str] = set()
        for full_path, content in content_by_path.items():
            basename = full_path.rsplit("/", 1)[-1]
            if path_filter and basename != path_filter:
                continue
            if ext_filter and not basename.endswith(ext_filter):
                continue
            # Match case-sensitively to mirror the registry's _rule_matches;
            # patterns that want case-insensitivity embed an inline (?i) flag.
            if re.search(pattern, content):
                result.add(_parent_dir(full_path))
        return result

    if "match_dir" in rule:
        dirname = rule["match_dir"]
        matching: set[str] = set()
        if dirname.startswith("."):
            for bn, paths in dirs_full_paths_by_basename.items():
                if bn.endswith(dirname):
                    matching.update(paths)
        else:
            matching = dirs_full_paths_by_basename.get(dirname, set())
        return {_parent_dir(p) for p in matching}

    if "match_ext" in rule:
        ext = rule["match_ext"]
        parents: set[str] = set()
        for bn, paths in files_full_paths_by_basename.items():
            if bn.endswith(ext):
                for p in paths:
                    parents.add(_parent_dir(p))
        return parents

    path = rule.get("path")
    if path is None:
        return set()
    return {_parent_dir(p) for p in files_full_paths_by_basename.get(path, set())}


def _framework_matches_scoped(
    fw: FrameworkDef,
    files_full_paths_by_basename: dict[str, set[str]],
    dirs_full_paths_by_basename: dict[str, set[str]],
    content_by_path: dict[str, str],
    manifests_by_path: dict[str, _PackageManifest],
) -> bool:
    """Co-location-aware framework matcher for the multi detector.

    For ``some``-only frameworks any single signal anywhere in the tree is
    sufficient.  For frameworks with ``every`` rules all conditions must be
    satisfiable within the same parent directory, preventing stray files in
    unrelated subtrees from causing false positives (e.g. a deployment
    ``.csproj`` in ``tools/deploy/`` combined with an unrelated
    ``appsettings.json`` in ``backend/`` must not fire ``dotnet-aspnetcore``).
    If ``some`` rules are also present they are additionally required to fire
    within at least one scope where all ``every`` rules are satisfied.
    """
    every = fw.get("every", [])
    some = fw.get("some", [])

    if not every and not some:
        return False

    def scopes_for(rule: DetectorRule) -> set[str]:
        return _rule_parent_dirs(
            rule,
            files_full_paths_by_basename,
            dirs_full_paths_by_basename,
            content_by_path,
            manifests_by_path,
        )

    if not every:
        return any(scopes_for(rule) for rule in some)

    # Collect the intersection of parent-dir scopes across all every rules.
    scopes: set[str] | None = None
    for rule in every:
        rule_scopes = scopes_for(rule)
        scopes = set(rule_scopes) if scopes is None else scopes & rule_scopes
        if not scopes:
            return False

    if not scopes:
        return False

    if not some:
        return True

    # every+some: at least one some rule must fire within a scope where all
    # every rules are already satisfied.
    return any(scope in scopes_for(rule) for scope in scopes for rule in some)


def detect_platforms_multi(
    client: GitHubBaseClient,
    repo: str,
    ref: str | None = None,
) -> MultiDetectionResult:
    """Detect Sentry platforms for a GitHub repository.

    Selects up to MAX_LANGUAGES base platforms by byte count, fetches the full
    recursive git tree once, then runs two high-confidence passes:

    - Pass 1 (existence): evaluates path/match_dir/match_ext rules with no
      extra API calls, co-location-aware so stray files in unrelated subtrees
      don't produce false positives.
    - Pass 2 (content reads): fetches up to MAX_CONTENT_READS files and
      evaluates match_content/match_package rules within the same per-file
      scope.

    Supersession runs after both high-confidence passes so that a framework
    detected via content reads (e.g. react-native from package.json) can
    supersede an existence match (e.g. apple-ios from *.xcodeproj) before the
    bare-language fallback is emitted.  Bare-language medium fallbacks fill in
    any base platform not claimed by either high pass.
    """
    start_time = time.monotonic()

    languages: dict[str, int] = client.get_languages(repo)
    active_platforms = _select_active_platforms(languages)

    tree_start = time.monotonic()
    entries, is_truncated = _get_tree(client, repo, ref)
    tree_duration_ms = (time.monotonic() - tree_start) * 1000
    index = _build_tree_index(entries)

    results: list[DetectedPlatform] = []
    seen_platforms: set[str] = set()

    # Pass 1: existence-only high matches (no API reads beyond the tree).
    # Co-location enforcement ensures every-rules all fire within the same
    # parent directory so stray files in unrelated subtrees don't match.
    for base_platform, lang_entries in active_platforms.items():
        language = max(lang_entries, key=lambda x: x[1])[0]
        byte_count = sum(b for _, b in lang_entries)

        for fw in _FRAMEWORKS_BY_PLATFORM.get(base_platform, []):
            if _framework_matches_scoped(
                fw,
                index.files_full_paths_by_basename,
                index.dirs_full_paths_by_basename,
                {},
                {},
            ):
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

    # Pass 2 (content reads): fetch up to MAX_CONTENT_READS files and evaluate
    # match_content / match_package rules within their per-file scope.
    needed_paths = _collect_needed_paths(active_platforms, index.files_full_paths_by_basename)
    # Sort shallowest paths first so root manifests (package.json, Gemfile, go.mod, …)
    # are always within the cap before subdirectory files from monorepo workspaces.
    capped_paths = sorted(needed_paths, key=lambda p: (p.count("/"), p))[:MAX_CONTENT_READS]

    content_reads_start = time.monotonic()
    content_by_path: dict[str, str] = {}
    for path in capped_paths:
        content = _get_repo_file_content(client, repo, path, ref)
        if content is not None:
            content_by_path[path] = content
    content_reads_duration_ms = (time.monotonic() - content_reads_start) * 1000

    manifests_by_path: dict[str, _PackageManifest] = {}
    for path, content in content_by_path.items():
        basename = path.rsplit("/", 1)[-1]
        manifest = _parse_package_manifest(content, basename)
        if manifest is not None:
            manifests_by_path[path] = manifest

    for base_platform, lang_entries in active_platforms.items():
        language = max(lang_entries, key=lambda x: x[1])[0]
        byte_count = sum(b for _, b in lang_entries)

        for fw in _FRAMEWORKS_BY_PLATFORM.get(base_platform, []):
            platform_id = fw["platform"]
            if platform_id in seen_platforms:
                continue
            if _framework_matches_scoped(
                fw,
                index.files_full_paths_by_basename,
                index.dirs_full_paths_by_basename,
                content_by_path,
                manifests_by_path,
            ):
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

    # Supersession runs after both high-confidence passes so a framework
    # detected via content reads can supersede an existence match.
    results = _apply_supersession(results)

    # Pass 3: bare-language medium fallbacks for base platforms not resolved
    # by either high pass.  Uses seen_platforms (not results) so supersession
    # above doesn't accidentally re-open a slot for a base platform whose
    # framework was just superseded by a higher-specificity content match.
    for base_platform, lang_entries in active_platforms.items():
        if base_platform not in seen_platforms:
            language = max(lang_entries, key=lambda x: x[1])[0]
            byte_count = sum(b for _, b in lang_entries)
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

    results = [r for r in results if r["platform"] not in _NON_SELECTABLE_PLATFORMS]
    results.sort(
        key=lambda r: (_CONFIDENCE_ORDER[r["confidence"]], r["bytes"], r["priority"]),
        reverse=True,
    )

    k_reads_realized = len(content_by_path)

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
    sentry_sdk.metrics.distribution(
        f"{_MULTI_METRICS_PREFIX}.k_reads_realized",
        k_reads_realized,
    )
    sentry_sdk.metrics.distribution(
        f"{_MULTI_METRICS_PREFIX}.tree.duration",
        tree_duration_ms,
        unit="millisecond",
    )
    sentry_sdk.metrics.distribution(
        f"{_MULTI_METRICS_PREFIX}.content_reads.duration",
        content_reads_duration_ms,
        unit="millisecond",
    )
    for needed_path in needed_paths:
        sentry_sdk.metrics.distribution(
            f"{_MULTI_METRICS_PREFIX}.needed_path_depth",
            needed_path.count("/"),
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
        k_reads_realized=k_reads_realized,
        tree_entry_count=len(entries),
        is_truncated=is_truncated,
    )
