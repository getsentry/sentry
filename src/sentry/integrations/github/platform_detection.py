from __future__ import annotations

import logging
import re
import time
from base64 import b64decode
from typing import TYPE_CHECKING

import sentry_sdk
from yaml import YAMLError

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
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils import json
from sentry.utils.yaml import safe_load

if TYPE_CHECKING:
    from sentry.integrations.github.client import GitHubBaseClient

logger = logging.getLogger(__name__)


def _ref_params(ref: str | None) -> dict[str, str]:
    return {"ref": ref} if ref else {}


def _get_repo_file_content(
    client: GitHubBaseClient, repo: str, path: str, ref: str | None = None
) -> str | None:
    """Fetch a file's content from a GitHub repo. Returns None if not found."""
    try:
        response = client.get(
            f"/repos/{repo}/contents/{path}",
            params=_ref_params(ref),
        )
        return b64decode(response["content"]).decode("utf-8")
    except (ApiError, KeyError, TypeError, UnicodeDecodeError, ValueError):
        return None


def _get_root_entries(
    client: GitHubBaseClient, repo: str, ref: str | None = None
) -> tuple[set[str] | None, set[str] | None]:
    """Fetch the root-level file and directory names in a single API call.

    Returns (None, None) on API failure so callers can fall back to
    fetching files individually rather than assuming the repo root is empty.
    """
    try:
        response = client.get(f"/repos/{repo}/contents", params=_ref_params(ref))
        files = {item["name"] for item in response if item.get("type") == "file" and "name" in item}
        dirs = {item["name"] for item in response if item.get("type") == "dir" and "name" in item}
        return files, dirs
    except (ApiError, AttributeError, TypeError):
        return None, None


def _parse_package_manifest(content: str, manifest_file: str) -> _PackageManifest | None:
    """Parse a package manifest into dependency sets."""
    try:
        if manifest_file == "package.json":
            pkg = json.loads(content)
            return _PackageManifest(
                dependencies=set((pkg.get("dependencies") or {}).keys()),
                dev_dependencies=set((pkg.get("devDependencies") or {}).keys()),
            )
        elif manifest_file == "composer.json":
            composer = json.loads(content)
            return _PackageManifest(
                dependencies=set((composer.get("require") or {}).keys()),
                dev_dependencies=set((composer.get("require-dev") or {}).keys()),
            )
        elif manifest_file == "pubspec.yaml":
            return _parse_pubspec_yaml(content)
        elif manifest_file == "Gemfile":
            return _parse_gemfile(content)
    except (json.JSONDecodeError, YAMLError, ValueError, KeyError, TypeError, AttributeError):
        pass
    return None


def _parse_pubspec_yaml(content: str) -> _PackageManifest:
    """Parse a pubspec.yaml file into dependency sets using PyYAML."""
    data = safe_load(content)
    if not isinstance(data, dict):
        return _PackageManifest(dependencies=set(), dev_dependencies=set())
    deps = set((data.get("dependencies") or {}).keys())
    dev_deps = set((data.get("dev_dependencies") or {}).keys())
    return _PackageManifest(dependencies=deps, dev_dependencies=dev_deps)


def _parse_gemfile(content: str) -> _PackageManifest:
    """Parse a Gemfile into dependency sets.

    Extracts gem names from ``gem "name"`` or ``gem 'name'`` lines.
    """
    deps: set[str] = set()
    gem_re = re.compile(r"""gem\s+['"]([^'"]+)['"]""")
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        match = gem_re.search(stripped)
        if match:
            deps.add(match.group(1))
    return _PackageManifest(dependencies=deps, dev_dependencies=set())


# Metric namespace for the single-platform detector.
_SINGLE_METRICS_PREFIX = "onboarding-scm.platform_detection.single"


def _bucket_languages_count(languages: dict[str, int]) -> str:
    """Count distinct Sentry base platforms among a repo's languages and bucket
    the result into a low-cardinality metric tag.

    SDK-less languages are ignored and related languages collapse to a single
    base platform (e.g. TypeScript + JavaScript -> javascript).
    """
    language_groups: set[str] = set()
    for language in languages:
        if language in IGNORED_LANGUAGES:
            continue
        base_platform = GITHUB_LANGUAGE_TO_SENTRY_PLATFORM.get(language)
        if base_platform is not None:
            language_groups.add(base_platform)
    count = len(language_groups)
    return "4+" if count >= 4 else str(count)


def _bucket_content_reads(needed_paths: set[str]) -> str:
    """Bucket the number of content-fetch API calls into a metric tag."""
    count = len(needed_paths)
    return "6+" if count >= 6 else str(count)


def detect_platforms(
    client: GitHubBaseClient,
    repo: str,
    ref: str | None = None,
) -> list[DetectedPlatform]:
    """
    Detect Sentry platforms for a GitHub repository.

    Uses composable framework definitions with five signal types:
    1. Config files — path-only rules (next.config.js, manage.py, etc.)
    2. Manifest content — path + match_content rules (requirements.txt, go.mod, etc.)
    3. Package dependencies — match_package rules (package.json, composer.json, etc.)
    4. Root directories — match_dir rules (Assets/, app/, etc.)
    5. File extensions — match_ext rules (.csproj, .uproject, etc.)

    Results are ranked by bytes (descending), then priority (descending).
    Superseded frameworks (e.g. React when Next.js is present) are removed.
    """
    start_time = time.monotonic()
    languages = client.get_languages(repo)
    root_files, root_dirs = _get_root_entries(client, repo, ref)

    # Find the top language and only process its base platform to limit
    # API calls — only one suggestion is shown to the user anyway.
    top_language: str | None = None
    top_bytes = 0
    for language, byte_count in languages.items():
        if language in IGNORED_LANGUAGES:
            continue
        if GITHUB_LANGUAGE_TO_SENTRY_PLATFORM.get(language) is not None and byte_count > top_bytes:
            top_language = language
            top_bytes = byte_count

    active_platforms: dict[str, list[tuple[str, int]]] = {}
    if top_language is not None:
        bp = GITHUB_LANGUAGE_TO_SENTRY_PLATFORM[top_language]
        active_platforms[bp] = [(top_language, top_bytes)]

    # Collect all file paths that need content fetching.
    # When root_files is None (API failed), try all paths rather than skipping.
    needed_paths: set[str] = set()
    for base_platform in active_platforms:
        # Include manifest files for match_package rules
        manifest_file = _PACKAGE_MANIFEST_FILES.get(base_platform)
        if manifest_file and (root_files is None or manifest_file in root_files):
            needed_paths.add(manifest_file)
        # Include files for match_content rules
        for fw in _FRAMEWORKS_BY_PLATFORM.get(base_platform, []):
            for rule in [*fw.get("every", []), *fw.get("some", [])]:
                if "match_content" not in rule:
                    continue
                path = rule.get("path")
                if path:
                    if root_files is None or path in root_files:
                        needed_paths.add(path)
                elif "match_ext" in rule and root_files is not None:
                    ext = rule["match_ext"]
                    for f in root_files:
                        if f.endswith(ext):
                            needed_paths.add(f)

    # Fetch file contents in one pass
    file_contents: dict[str, str] = {}
    for path in needed_paths:
        content = _get_repo_file_content(client, repo, path, ref)
        if content is not None:
            file_contents[path] = content

    # Parse package manifests for platforms that use match_package rules
    package_manifests: dict[str, _PackageManifest | None] = {}
    for base_platform in active_platforms:
        manifest_file = _PACKAGE_MANIFEST_FILES.get(base_platform)
        if manifest_file is None or manifest_file in package_manifests:
            continue
        if root_files is not None and manifest_file not in root_files:
            package_manifests[manifest_file] = None
            continue
        content = file_contents.get(manifest_file)
        package_manifests[manifest_file] = (
            _parse_package_manifest(content, manifest_file) if content else None
        )

    # Evaluate frameworks per base platform
    results: list[DetectedPlatform] = []
    seen_platforms: set[str] = set()

    for base_platform, lang_entries in active_platforms.items():
        language, byte_count = max(lang_entries, key=lambda x: x[1])

        manifest_file = _PACKAGE_MANIFEST_FILES.get(base_platform)
        manifest = package_manifests.get(manifest_file) if manifest_file else None

        for fw in _FRAMEWORKS_BY_PLATFORM.get(base_platform, []):
            if _framework_matches(fw, root_files, file_contents, manifest, root_dirs):
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
    results.sort(key=lambda r: (r["bytes"], r["priority"]), reverse=True)

    sentry_sdk.metrics.distribution(
        f"{_SINGLE_METRICS_PREFIX}.duration",
        (time.monotonic() - start_time) * 1000,
        unit="millisecond",
    )
    sentry_sdk.metrics.count(
        f"{_SINGLE_METRICS_PREFIX}.completed",
        1,
        attributes={
            "confidence": results[0]["confidence"] if results else "none",
            "detected_platforms_count": len(results),
            "languages_count": _bucket_languages_count(languages),
            "content_reads": _bucket_content_reads(needed_paths),
        },
    )

    return results
