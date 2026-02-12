"""Maps changed source files to their corresponding test files.

This module implements heuristic-based mapping from source files to test files
using Sentry's naming conventions:

    src/sentry/api/endpoints/organization_details.py
    → tests/sentry/api/endpoints/test_organization_details.py

    src/sentry/models/organization.py
    → tests/sentry/models/test_organization.py

Usage:
    from sentry_sandbox.testmap import find_test_files

    changed_files = [
        "src/sentry/api/endpoints/organization_details.py",
        "src/sentry/models/organization.py",
    ]
    test_files = find_test_files(changed_files)
    # => ["tests/sentry/api/endpoints/test_organization_details.py",
    #     "tests/sentry/models/test_organization.py"]
"""

from __future__ import annotations

import os
from pathlib import Path


def find_test_files(
    changed_files: list[str],
    repo_root: str | None = None,
) -> list[str]:
    """Map changed source files to test files.

    Args:
        changed_files: List of changed file paths (relative to repo root).
        repo_root: Repository root directory. If None, auto-detected.

    Returns:
        List of test file paths that exist on disk.
    """
    if repo_root is None:
        repo_root = _find_repo_root()

    test_files: list[str] = []
    seen: set[str] = set()

    for changed_file in changed_files:
        for candidate in _generate_test_candidates(changed_file):
            if candidate in seen:
                continue
            seen.add(candidate)

            full_path = os.path.join(repo_root, candidate)
            if os.path.isfile(full_path):
                test_files.append(candidate)

    return sorted(test_files)


def _generate_test_candidates(source_path: str) -> list[str]:
    """Generate candidate test file paths for a given source file.

    Applies multiple heuristics based on Sentry's conventions.
    """
    candidates: list[str] = []
    path = Path(source_path)

    # Skip non-Python files
    if path.suffix != ".py":
        return candidates

    # Skip test files themselves, __init__.py, migrations
    if path.name.startswith("test_") or path.name == "__init__.py":
        return candidates
    if "migrations" in path.parts:
        return candidates

    # Heuristic 1: src/sentry/... → tests/sentry/...
    # e.g., src/sentry/api/endpoints/foo.py → tests/sentry/api/endpoints/test_foo.py
    parts = list(path.parts)
    if len(parts) > 1 and parts[0] == "src":
        # Replace src/ with tests/
        test_parts = ["tests"] + parts[1:]
        # Add test_ prefix to filename
        test_parts[-1] = f"test_{path.name}"
        candidates.append(str(Path(*test_parts)))

        # Also try without the direct mapping (some tests are in different locations)
        # e.g., src/sentry/models/foo.py might have tests in tests/sentry/test_foo.py
        if len(test_parts) > 3:
            alt_parts = ["tests", parts[1], f"test_{path.name}"]
            candidates.append(str(Path(*alt_parts)))

    # Heuristic 2: For API endpoints, also check serializer tests
    # e.g., src/sentry/api/endpoints/organization_details.py
    #     → tests/sentry/api/serializers/test_organization.py
    if "api" in parts and "endpoints" in parts:
        serializer_name = path.stem.split("_")[0] if "_" in path.stem else path.stem
        serializer_test = Path("tests", "sentry", "api", "serializers", f"test_{serializer_name}.py")
        candidates.append(str(serializer_test))

    # Heuristic 3: For tasks, check tests/sentry/tasks/
    if "tasks" in parts:
        task_test = Path("tests", "sentry", "tasks", f"test_{path.name}")
        candidates.append(str(task_test))

    # Heuristic 4: For models, check tests/sentry/models/
    if "models" in parts:
        model_test = Path("tests", "sentry", "models", f"test_{path.name}")
        candidates.append(str(model_test))

    return candidates


def find_related_files(
    changed_files: list[str],
    repo_root: str | None = None,
) -> dict[str, list[str]]:
    """Map each changed file to its related test files.

    Args:
        changed_files: List of changed file paths.
        repo_root: Repository root directory.

    Returns:
        Dict mapping source file → list of test files.
    """
    if repo_root is None:
        repo_root = _find_repo_root()

    result: dict[str, list[str]] = {}
    for changed_file in changed_files:
        test_files = find_test_files([changed_file], repo_root)
        if test_files:
            result[changed_file] = test_files

    return result


def _find_repo_root() -> str:
    """Find the Sentry repository root by looking for pyproject.toml."""
    current = Path.cwd()
    for parent in [current, *current.parents]:
        if (parent / "pyproject.toml").exists() and (parent / "src" / "sentry").exists():
            return str(parent)
    raise RuntimeError("Could not find Sentry repository root")
