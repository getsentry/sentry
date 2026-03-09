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
    except (ApiError, KeyError, TypeError, UnicodeDecodeError, ValueError):
        return None


def _detect_frameworks_from_content(
    content: str,
    manifest_file: str,
    dependency_map: dict[str, str],
) -> list[str]:
    """Check manifest file content for known framework dependencies."""
    detected: list[str] = []

    if manifest_file == "package.json":
        try:
            pkg = json.loads(content)
            all_deps: dict[str, str] = {}
            all_deps.update(pkg.get("dependencies", {}))
            all_deps.update(pkg.get("devDependencies", {}))
            for dep_name, platform_id in dependency_map.items():
                if dep_name in all_deps:
                    detected.append(platform_id)
        except (json.JSONDecodeError, TypeError):
            pass

    elif manifest_file == "composer.json":
        try:
            composer = json.loads(content)
            all_deps = {}
            all_deps.update(composer.get("require", {}))
            all_deps.update(composer.get("require-dev", {}))
            for dep_name, platform_id in dependency_map.items():
                for pkg_name in all_deps:
                    if pkg_name == dep_name or pkg_name.startswith(dep_name):
                        detected.append(platform_id)
                        break
        except (json.JSONDecodeError, TypeError):
            pass

    else:
        # Text-based manifest files: requirements.txt, Gemfile,
        # pyproject.toml, build.gradle, pom.xml, go.mod
        content_lower = content.lower()
        for dep_name, platform_id in dependency_map.items():
            if dep_name.lower() in content_lower:
                detected.append(platform_id)

    return detected


def detect_framework(
    client: GitHubBaseClient,
    repo: str,
    base_platform: str,
    ref: str | None = None,
) -> list[str]:
    """
    Refine a base platform (e.g. "python") into specific framework
    platforms (e.g. "python-django") by reading manifest files.

    Returns detected framework platform IDs, or an empty list if none found.
    """
    detectors = FRAMEWORK_DETECTORS.get(base_platform, [])
    detected: list[str] = []

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
    unique: list[str] = []
    for platform_id in detected:
        if platform_id not in seen:
            seen.add(platform_id)
            unique.append(platform_id)

    return unique


def detect_platforms(
    client: GitHubBaseClient,
    repo: str,
    ref: str | None = None,
) -> list[DetectedPlatform]:
    """
    Detect Sentry platforms for a GitHub repository.

    Calls the GitHub Languages API, maps languages to Sentry platform IDs,
    and attempts framework refinement via manifest file inspection.

    Returns platforms ordered by relevance (bytes of code, descending).
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

        frameworks = detect_framework(client, repo, base_platform, ref)

        for framework_id in frameworks:
            if framework_id not in seen_platforms:
                seen_platforms.add(framework_id)
                results.append(
                    DetectedPlatform(
                        platform=framework_id,
                        language=language,
                        bytes=byte_count,
                        confidence="high",
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
                )
            )

    return results
