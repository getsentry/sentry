from __future__ import annotations

import logging
from base64 import b64decode
from typing import TYPE_CHECKING, TypedDict

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


# Priority weights: higher = more specific/useful for onboarding
FRAMEWORK_PRIORITY: dict[str, int] = {
    # JS meta-frameworks (most specific, include routing/SSR)
    "javascript-nextjs": 100,
    "javascript-remix": 100,
    "javascript-nuxt": 100,
    # JS UI frameworks
    "javascript-react": 70,
    "javascript-vue": 70,
    "javascript-angular": 70,
    "javascript-svelte": 70,
    # JS server frameworks
    "node-express": 60,
    "node-hono": 60,
    "node-koa": 60,
    # Python web frameworks
    "python-django": 90,
    "python-fastapi": 90,
    "python-flask": 80,
    "python-starlette": 70,
    "python-tornado": 70,
    # Python task queues (useful but secondary)
    "python-celery": 40,
    # Ruby
    "ruby-rails": 90,
    # PHP
    "php-laravel": 90,
    "php-symfony": 80,
    # Java
    "java-spring-boot": 90,
    "java-spring": 80,
    # Go
    "go-echo": 80,
    "go-gin": 80,
    "go-fiber": 80,
}

# Base platform priority (used when no framework detected)
BASE_PLATFORM_PRIORITY = 10

# When a parent framework is detected, child frameworks are redundant.
# e.g. Next.js includes React, so don't also suggest React.
SUPERSEDED_BY: dict[str, list[str]] = {
    "javascript-nextjs": ["javascript-react"],
    "javascript-remix": ["javascript-react"],
    "javascript-nuxt": ["javascript-vue"],
}


class FrameworkMatch(TypedDict):
    platform: str
    dep_source: str  # "dependencies", "devDependencies", or "unknown"


# Maps base_platform -> list of (manifest_file, {dependency_name: sentry_platform_id})
FRAMEWORK_DETECTORS: dict[str, list[tuple[str, dict[str, str]]]] = {
    "javascript": [
        (
            "package.json",
            {
                "next": "javascript-nextjs",
                "react": "javascript-react",
                "vue": "javascript-vue",
                "@angular/core": "javascript-angular",
                "svelte": "javascript-svelte",
                "remix": "javascript-remix",
                "nuxt": "javascript-nuxt",
                "express": "node-express",
                "hono": "node-hono",
                "koa": "node-koa",
            },
        ),
    ],
    "python": [
        (
            "requirements.txt",
            {
                "django": "python-django",
                "flask": "python-flask",
                "fastapi": "python-fastapi",
                "starlette": "python-starlette",
                "celery": "python-celery",
                "tornado": "python-tornado",
            },
        ),
        (
            "pyproject.toml",
            {
                "django": "python-django",
                "flask": "python-flask",
                "fastapi": "python-fastapi",
                "starlette": "python-starlette",
                "celery": "python-celery",
                "tornado": "python-tornado",
            },
        ),
        (
            "Pipfile",
            {
                "django": "python-django",
                "flask": "python-flask",
                "fastapi": "python-fastapi",
                "starlette": "python-starlette",
                "celery": "python-celery",
                "tornado": "python-tornado",
            },
        ),
    ],
    "ruby": [
        (
            "Gemfile",
            {
                "rails": "ruby-rails",
            },
        ),
    ],
    "php": [
        (
            "composer.json",
            {
                "laravel/framework": "php-laravel",
                "symfony/": "php-symfony",
            },
        ),
    ],
    "java": [
        (
            "build.gradle",
            {
                "spring-boot": "java-spring-boot",
                "spring-framework": "java-spring",
            },
        ),
        (
            "pom.xml",
            {
                "spring-boot": "java-spring-boot",
                "spring-framework": "java-spring",
            },
        ),
    ],
    "go": [
        (
            "go.mod",
            {
                "echo": "go-echo",
                "gin": "go-gin",
                "fiber": "go-fiber",
            },
        ),
    ],
}


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
    except ApiError:
        return None


def _detect_frameworks_from_content(
    content: str,
    manifest_file: str,
    dependency_map: dict[str, str],
) -> list[FrameworkMatch]:
    """Check manifest file content for known framework dependencies.

    Returns FrameworkMatch objects that include which dependency section
    the framework was found in (dependencies vs devDependencies).
    """
    detected: list[FrameworkMatch] = []

    if manifest_file == "package.json":
        try:
            pkg = json.loads(content)
            prod_deps = set(pkg.get("dependencies", {}).keys())
            dev_deps = set(pkg.get("devDependencies", {}).keys())
            for dep_name, platform_id in dependency_map.items():
                if dep_name in prod_deps:
                    detected.append(FrameworkMatch(platform=platform_id, dep_source="dependencies"))
                elif dep_name in dev_deps:
                    detected.append(
                        FrameworkMatch(platform=platform_id, dep_source="devDependencies")
                    )
        except (json.JSONDecodeError, TypeError):
            pass

    elif manifest_file == "composer.json":
        try:
            composer = json.loads(content)
            prod_deps = set(composer.get("require", {}).keys())
            dev_deps = set(composer.get("require-dev", {}).keys())
            for dep_name, platform_id in dependency_map.items():
                source = None
                for pkg_name in prod_deps:
                    if pkg_name == dep_name or pkg_name.startswith(dep_name):
                        source = "dependencies"
                        break
                if source is None:
                    for pkg_name in dev_deps:
                        if pkg_name == dep_name or pkg_name.startswith(dep_name):
                            source = "devDependencies"
                            break
                if source is not None:
                    detected.append(FrameworkMatch(platform=platform_id, dep_source=source))
        except (json.JSONDecodeError, TypeError):
            pass

    else:
        # Text-based manifest files: requirements.txt, Gemfile,
        # pyproject.toml, build.gradle, pom.xml, go.mod
        content_lower = content.lower()
        for dep_name, platform_id in dependency_map.items():
            if dep_name.lower() in content_lower:
                detected.append(FrameworkMatch(platform=platform_id, dep_source="unknown"))

    return detected


def detect_framework(
    client: GitHubBaseClient,
    repo: str,
    base_platform: str,
    ref: str | None = None,
) -> list[FrameworkMatch]:
    """
    Refine a base platform (e.g. "python") into specific framework
    platforms (e.g. "python-django") by reading manifest files.

    Returns FrameworkMatch objects, or an empty list if none found.
    """
    detectors = FRAMEWORK_DETECTORS.get(base_platform, [])
    detected: list[FrameworkMatch] = []

    for manifest_file, dependency_map in detectors:
        content = _get_repo_file_content(client, repo, manifest_file, ref)
        if content is None:
            continue
        frameworks = _detect_frameworks_from_content(content, manifest_file, dependency_map)
        detected.extend(frameworks)
        if detected:
            break

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique: list[FrameworkMatch] = []
    for match in detected:
        if match["platform"] not in seen:
            seen.add(match["platform"])
            unique.append(match)

    return unique


def _apply_supersession(results: list[DetectedPlatform]) -> list[DetectedPlatform]:
    """Remove platforms that are superseded by more specific ones.

    e.g. if Next.js is detected, React is redundant since Next.js includes it.
    """
    detected_ids = {r["platform"] for r in results}
    superseded: set[str] = set()
    for platform_id in detected_ids:
        for child_id in SUPERSEDED_BY.get(platform_id, []):
            superseded.add(child_id)

    return [r for r in results if r["platform"] not in superseded]


# Bonus priority for frameworks found in production dependencies vs devDependencies
_DEP_SOURCE_BONUS = {
    "dependencies": 10,
    "devDependencies": 0,
    "unknown": 5,
}


def detect_platforms(
    client: GitHubBaseClient,
    repo: str,
    ref: str | None = None,
) -> list[DetectedPlatform]:
    """
    Detect Sentry platforms for a GitHub repository.

    Calls the GitHub Languages API, maps languages to Sentry platform IDs,
    and attempts framework refinement via manifest file inspection.

    Results are ranked by priority (descending), then bytes (descending).
    Superseded frameworks (e.g. React when Next.js is present) are removed.
    """
    languages = client.get_languages(repo)

    results: list[DetectedPlatform] = []
    seen_platforms: set[str] = set()

    for language, byte_count in languages.items():
        if language in IGNORED_LANGUAGES:
            continue

        base_platform = GITHUB_LANGUAGE_TO_SENTRY_PLATFORM.get(language)
        if base_platform is None:
            continue

        framework_matches = detect_framework(client, repo, base_platform, ref)

        for match in framework_matches:
            framework_id = match["platform"]
            if framework_id not in seen_platforms:
                seen_platforms.add(framework_id)
                base_priority = FRAMEWORK_PRIORITY.get(framework_id, 50)
                dep_bonus = _DEP_SOURCE_BONUS.get(match["dep_source"], 0)
                results.append(
                    DetectedPlatform(
                        platform=framework_id,
                        language=language,
                        bytes=byte_count,
                        confidence="high",
                        priority=base_priority + dep_bonus,
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
                    priority=BASE_PLATFORM_PRIORITY,
                )
            )

    results = _apply_supersession(results)
    results.sort(key=lambda r: (r["priority"], r["bytes"]), reverse=True)

    return results
