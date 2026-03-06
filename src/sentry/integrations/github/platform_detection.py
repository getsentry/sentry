from __future__ import annotations

import logging
import re
from base64 import b64decode
from collections import defaultdict
from collections.abc import Sequence
from typing import TYPE_CHECKING, NotRequired, TypedDict

from sentry.shared_integrations.exceptions import ApiError
from sentry.utils import json

if TYPE_CHECKING:
    from sentry.integrations.github.client import GitHubBaseClient

logger = logging.getLogger(__name__)

# GitHub Linguist name → Sentry base platform ID
GITHUB_LANGUAGE_TO_SENTRY_PLATFORM: dict[str, str] = {
    "Python": "python",
    "JavaScript": "javascript",
    "TypeScript": "javascript",
    "Java": "java",
    "Kotlin": "kotlin",
    "Swift": "swift",
    "Objective-C": "apple-ios",
    "Objective-C++": "apple-ios",
    "Go": "go",
    "Ruby": "ruby",
    "PHP": "php",
    "Rust": "rust",
    "C#": "dotnet",
    "Dart": "dart",
    "Elixir": "elixir",
    "C": "native",
    "C++": "native",
    "Perl": "perl",
}

# Languages with no Sentry SDK — filtered out of detection results
IGNORED_LANGUAGES = frozenset(
    {
        "Shell",
        "Makefile",
        "Dockerfile",
        "HTML",
        "CSS",
        "SCSS",
        "Less",
        "Vim Script",
        "Emacs Lisp",
        "Nix",
        "Starlark",
        "HCL",
        "Jsonnet",
        "Batchfile",
        "PowerShell",
        "CMake",
        "M4",
        "Roff",
        "TeX",
        "XSLT",
        "PLpgSQL",
        "PLSQL",
        "TSQL",
    }
)


class DetectedPlatform(TypedDict):
    platform: str  # Sentry platform ID, e.g. "python-django"
    language: str  # GitHub Linguist name, e.g. "Python"
    bytes: int  # Bytes of code in that language
    confidence: str  # "high" (framework detected) or "medium" (language only)
    priority: int  # Higher = more relevant for onboarding


class DetectorRule(TypedDict, total=False):
    path: str  # File must exist in root directory
    match_content: str  # Regex pattern to match in file content (requires path)
    match_package: str  # Package name in package.json/composer.json deps


class FrameworkDef(TypedDict):
    platform: str  # Sentry platform ID, e.g. "javascript-nextjs"
    sort: int  # Lower = higher priority
    base_platform: str  # Language group, e.g. "javascript"
    every: NotRequired[list[DetectorRule]]  # ALL must match (AND)
    some: NotRequired[list[DetectorRule]]  # At least ONE must match (OR)
    supersedes: NotRequired[list[str]]  # Platform IDs this makes redundant


# Each framework is a self-contained definition with composable detector rules.
#
# The `sort` field controls priority within a language group for onboarding.
# Lower sort = higher priority. Converted to `priority = 100 - sort` in output.
# Across languages, byte count (language majority) is the primary ranking factor.
#
#   sort=1      Meta-frameworks         Next.js, Remix, Nuxt, SvelteKit
#   sort=10     Primary frameworks      Django, Rails, Laravel, Spring Boot
#   sort=20     Secondary frameworks    Flask, Go frameworks, PHP Symfony
#   sort=30     UI / general            React, Vue, Angular, Svelte, Starlette
#   sort=40     Server frameworks       Express, Koa
#   sort=60     Utilities / background  Celery
FRAMEWORKS: list[FrameworkDef] = [
    # --- JavaScript meta-frameworks (sort=1, highest priority) ---
    {
        "platform": "javascript-nextjs",
        "sort": 1,
        "base_platform": "javascript",
        "some": [
            {"match_package": "next"},
            {"path": "next.config.js"},
            {"path": "next.config.mjs"},
            {"path": "next.config.ts"},
        ],
        "supersedes": ["javascript-react"],
    },
    {
        "platform": "javascript-remix",
        "sort": 1,
        "base_platform": "javascript",
        "some": [
            {"match_package": "remix"},
            {"path": "remix.config.js"},
            {"path": "remix.config.mjs"},
        ],
        "supersedes": ["javascript-react"],
    },
    {
        "platform": "javascript-nuxt",
        "sort": 1,
        "base_platform": "javascript",
        "some": [
            {"match_package": "nuxt"},
            {"path": "nuxt.config.ts"},
            {"path": "nuxt.config.js"},
        ],
        "supersedes": ["javascript-vue"],
    },
    # --- JavaScript UI frameworks (sort=30) ---
    {
        "platform": "javascript-react",
        "sort": 30,
        "base_platform": "javascript",
        "some": [{"match_package": "react"}],
    },
    {
        "platform": "javascript-vue",
        "sort": 30,
        "base_platform": "javascript",
        "some": [{"match_package": "vue"}],
    },
    {
        "platform": "javascript-angular",
        "sort": 30,
        "base_platform": "javascript",
        "some": [
            {"match_package": "@angular/core"},
            {"path": "angular.json"},
        ],
    },
    {
        "platform": "javascript-svelte",
        "sort": 30,
        "base_platform": "javascript",
        "some": [
            {"match_package": "svelte"},
            {"path": "svelte.config.js"},
            {"path": "svelte.config.ts"},
        ],
    },
    # --- JavaScript server frameworks (sort=40) ---
    {
        "platform": "node-express",
        "sort": 40,
        "base_platform": "javascript",
        "every": [{"match_package": "express"}],
    },
    {
        "platform": "node-hono",
        "sort": 40,
        "base_platform": "javascript",
        "every": [{"match_package": "hono"}],
    },
    {
        "platform": "node-koa",
        "sort": 40,
        "base_platform": "javascript",
        "every": [{"match_package": "koa"}],
    },
    # --- Python frameworks ---
    {
        "platform": "python-django",
        "sort": 10,
        "base_platform": "python",
        "some": [
            {"path": "manage.py"},
            {"path": "requirements.txt", "match_content": r"(?i)\bdjango\b"},
            {"path": "pyproject.toml", "match_content": r"(?i)\bdjango\b"},
            {"path": "Pipfile", "match_content": r"(?i)\bdjango\b"},
        ],
    },
    {
        "platform": "python-fastapi",
        "sort": 10,
        "base_platform": "python",
        "some": [
            {"path": "requirements.txt", "match_content": r"(?i)\bfastapi\b"},
            {"path": "pyproject.toml", "match_content": r"(?i)\bfastapi\b"},
            {"path": "Pipfile", "match_content": r"(?i)\bfastapi\b"},
        ],
    },
    {
        "platform": "python-flask",
        "sort": 20,
        "base_platform": "python",
        "some": [
            {"path": "requirements.txt", "match_content": r"(?i)\bflask\b"},
            {"path": "pyproject.toml", "match_content": r"(?i)\bflask\b"},
            {"path": "Pipfile", "match_content": r"(?i)\bflask\b"},
        ],
    },
    {
        "platform": "python-starlette",
        "sort": 30,
        "base_platform": "python",
        "some": [
            {"path": "requirements.txt", "match_content": r"(?i)\bstarlette\b"},
            {"path": "pyproject.toml", "match_content": r"(?i)\bstarlette\b"},
            {"path": "Pipfile", "match_content": r"(?i)\bstarlette\b"},
        ],
    },
    {
        "platform": "python-tornado",
        "sort": 30,
        "base_platform": "python",
        "some": [
            {"path": "requirements.txt", "match_content": r"(?i)\btornado\b"},
            {"path": "pyproject.toml", "match_content": r"(?i)\btornado\b"},
            {"path": "Pipfile", "match_content": r"(?i)\btornado\b"},
        ],
    },
    {
        "platform": "python-celery",
        "sort": 60,
        "base_platform": "python",
        "some": [
            {"path": "requirements.txt", "match_content": r"(?i)\bcelery\b"},
            {"path": "pyproject.toml", "match_content": r"(?i)\bcelery\b"},
            {"path": "Pipfile", "match_content": r"(?i)\bcelery\b"},
        ],
    },
    # --- Ruby ---
    {
        "platform": "ruby-rails",
        "sort": 10,
        "base_platform": "ruby",
        "some": [
            {"path": "Gemfile", "match_content": r"(?i)\brails\b"},
        ],
    },
    # --- PHP ---
    {
        "platform": "php-laravel",
        "sort": 10,
        "base_platform": "php",
        "some": [
            {"match_package": "laravel/framework"},
            {"path": "artisan"},
        ],
    },
    {
        "platform": "php-symfony",
        "sort": 20,
        "base_platform": "php",
        "some": [
            {"match_package": "symfony/"},
        ],
    },
    # --- Java ---
    {
        "platform": "java-spring-boot",
        "sort": 10,
        "base_platform": "java",
        "some": [
            {"path": "build.gradle", "match_content": r"spring-boot"},
            {"path": "pom.xml", "match_content": r"spring-boot"},
        ],
    },
    {
        "platform": "java-spring",
        "sort": 20,
        "base_platform": "java",
        "some": [
            {"path": "build.gradle", "match_content": r"spring-framework"},
            {"path": "pom.xml", "match_content": r"spring-framework"},
        ],
    },
    # --- Go ---
    {
        "platform": "go-echo",
        "sort": 20,
        "base_platform": "go",
        "some": [
            {"path": "go.mod", "match_content": r"(?i)\becho\b"},
        ],
    },
    {
        "platform": "go-gin",
        "sort": 20,
        "base_platform": "go",
        "some": [
            {"path": "go.mod", "match_content": r"(?i)\bgin\b"},
        ],
    },
    {
        "platform": "go-fiber",
        "sort": 20,
        "base_platform": "go",
        "some": [
            {"path": "go.mod", "match_content": r"(?i)\bfiber\b"},
        ],
    },
]

# Derived indexes built at module load
_FRAMEWORKS_BY_PLATFORM: dict[str, list[FrameworkDef]] = defaultdict(list)
for _fw in FRAMEWORKS:
    _FRAMEWORKS_BY_PLATFORM[_fw["base_platform"]].append(_fw)

_SUPERSESSION_MAP: dict[str, list[str]] = {}
for _fw in FRAMEWORKS:
    if "supersedes" in _fw:
        _SUPERSESSION_MAP[_fw["platform"]] = _fw["supersedes"]

# Package manifest files per base platform (for match_package rules)
_PACKAGE_MANIFEST_FILES: dict[str, str] = {
    "javascript": "package.json",
    "php": "composer.json",
}


class _PackageManifest(TypedDict):
    dependencies: set[str]
    dev_dependencies: set[str]


def _get_repo_file_content(
    client: GitHubBaseClient, repo: str, path: str, ref: str | None = None
) -> str | None:
    """Fetch a file's content from a GitHub repo. Returns None if not found."""
    try:
        params: dict[str, str] = {}
        if ref:
            params["ref"] = ref
        response = client.get(
            f"/repos/{repo}/contents/{path}",
            params=params,
        )
        return b64decode(response["content"]).decode("utf-8")
    except (ApiError, KeyError, TypeError, UnicodeDecodeError, ValueError):
        return None


def _get_root_file_names(
    client: GitHubBaseClient, repo: str, ref: str | None = None
) -> set[str] | None:
    """Fetch the list of file names in the repository root directory.

    Uses the GitHub Contents API on the root path, which returns all
    top-level files and directories in a single API call.

    Returns None on API failure so callers can fall back to fetching
    files individually rather than assuming the repo root is empty.
    """
    try:
        params: dict[str, str] = {}
        if ref:
            params["ref"] = ref
        response = client.get(f"/repos/{repo}/contents", params=params)
        return {item["name"] for item in response if item.get("type") == "file" and "name" in item}
    except (ApiError, AttributeError, TypeError):
        return None


def _parse_package_manifest(content: str, manifest_file: str) -> _PackageManifest | None:
    """Parse a JSON package manifest into dependency sets."""
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
    except (json.JSONDecodeError, TypeError):
        pass
    return None


def _package_in_manifest(package_name: str, manifest: _PackageManifest | None) -> bool:
    """Check if a package exists in a manifest's dependencies or devDependencies."""
    if manifest is None:
        return False
    all_deps = manifest["dependencies"] | manifest["dev_dependencies"]
    if package_name in all_deps:
        return True
    # Prefix match for composer.json patterns like "symfony/"
    if package_name.endswith("/"):
        return any(dep.startswith(package_name) for dep in all_deps)
    return False


def _rule_matches(
    rule: DetectorRule,
    root_files: set[str] | None,
    file_contents: dict[str, str],
    package_manifest: _PackageManifest | None,
) -> bool:
    """Evaluate a single detector rule against repository state."""
    if "match_package" in rule:
        return _package_in_manifest(rule["match_package"], package_manifest)

    path = rule.get("path")
    if path is None:
        return False

    if "match_content" in rule:
        content = file_contents.get(path)
        if content is None:
            return False
        return bool(re.search(rule["match_content"], content))

    # path-only rule: check if file exists in root
    # When root_files is None (API failed), we can't confirm existence
    if root_files is None:
        return False
    return path in root_files


def _framework_matches(
    fw: FrameworkDef,
    root_files: set[str] | None,
    file_contents: dict[str, str],
    package_manifest: _PackageManifest | None,
) -> bool:
    """Evaluate whether a framework definition matches the repository."""
    every: Sequence[DetectorRule] = fw.get("every", [])
    some: Sequence[DetectorRule] = fw.get("some", [])

    if not every and not some:
        return False

    every_pass = all(_rule_matches(r, root_files, file_contents, package_manifest) for r in every)
    some_pass = (
        any(_rule_matches(r, root_files, file_contents, package_manifest) for r in some)
        if some
        else True
    )

    return every_pass and some_pass


def _apply_supersession(results: list[DetectedPlatform]) -> list[DetectedPlatform]:
    """Remove platforms that are superseded by more specific ones.

    e.g. if Next.js is detected, React is redundant since Next.js includes it.
    """
    platform_ids = {r["platform"] for r in results}
    superseded: set[str] = set()
    for platform_id in platform_ids:
        for child_id in _SUPERSESSION_MAP.get(platform_id, []):
            superseded.add(child_id)

    return [r for r in results if r["platform"] not in superseded]


def detect_platforms(
    client: GitHubBaseClient,
    repo: str,
    ref: str | None = None,
) -> list[DetectedPlatform]:
    """
    Detect Sentry platforms for a GitHub repository.

    Uses composable framework definitions with three signal types:
    1. Config files — path-only rules (next.config.js, manage.py, etc.)
    2. Manifest content — path + match_content rules (requirements.txt, go.mod, etc.)
    3. Package dependencies — match_package rules (package.json, composer.json)

    Results are ranked by bytes (descending), then priority (descending).
    Superseded frameworks (e.g. React when Next.js is present) are removed.
    """
    languages = client.get_languages(repo)
    root_files = _get_root_file_names(client, repo, ref)

    # Group languages by base platform
    active_platforms: dict[str, list[tuple[str, int]]] = defaultdict(list)
    for language, byte_count in languages.items():
        if language in IGNORED_LANGUAGES:
            continue
        base_platform = GITHUB_LANGUAGE_TO_SENTRY_PLATFORM.get(language)
        if base_platform is not None:
            active_platforms[base_platform].append((language, byte_count))

    # Collect all file paths that need content fetching (path + match_content rules).
    # When root_files is None (API failed), try all paths rather than skipping.
    needed_paths: set[str] = set()
    for base_platform in active_platforms:
        for fw in _FRAMEWORKS_BY_PLATFORM.get(base_platform, []):
            for rule in [*fw.get("every", []), *fw.get("some", [])]:
                path = rule.get("path")
                if path and "match_content" in rule:
                    if root_files is None or path in root_files:
                        needed_paths.add(path)

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
        if content is None:
            content = _get_repo_file_content(client, repo, manifest_file, ref)
            if content is not None:
                file_contents[manifest_file] = content
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
            if _framework_matches(fw, root_files, file_contents, manifest):
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
    results.sort(key=lambda r: (r["bytes"], r["priority"]), reverse=True)

    return results
