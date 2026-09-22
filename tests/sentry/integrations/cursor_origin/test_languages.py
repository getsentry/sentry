from __future__ import annotations

from typing import Any

from sentry.integrations.cursor_origin.languages import (
    EXTENSION_TO_LANGUAGE,
    languages_from_tree,
)
from sentry.integrations.github.platform_registry import GITHUB_LANGUAGE_TO_SENTRY_PLATFORM


def blob(path: str, size: int = 100) -> dict[str, Any]:
    return {"path": path, "mode": "100644", "type": "blob", "sha": "abc", "size": size}


def tree(path: str) -> dict[str, Any]:
    return {"path": path, "mode": "040000", "type": "tree", "sha": "abc"}


def gitlink(path: str) -> dict[str, Any]:
    return {"path": path, "mode": "160000", "type": "commit", "sha": "abc"}


def symlink(path: str, size: int = 20) -> dict[str, Any]:
    return {"path": path, "mode": "120000", "type": "blob", "sha": "abc", "size": size}


def test_empty_tree() -> None:
    assert languages_from_tree([]) == {}


def test_sums_bytes_per_language() -> None:
    assert languages_from_tree(
        [
            blob("app/main.py", 300),
            blob("app/util.py", 200),
            blob("web/index.ts", 50),
            blob("web/App.tsx", 25),
        ]
    ) == {"Python": 500, "TypeScript": 75}


def test_keys_are_registry_compatible() -> None:
    # Diverging from Linguist's names would make platform detection silently find
    # nothing.
    assert set(EXTENSION_TO_LANGUAGE.values()) <= set(GITHUB_LANGUAGE_TO_SENTRY_PLATFORM)
    assert languages_from_tree(
        [blob("Api.cs"), blob("main.go"), blob("app.rb"), blob("lib.rs")]
    ) == {"C#": 100, "Go": 100, "Ruby": 100, "Rust": 100}


def test_ignores_trees_and_gitlinks() -> None:
    entries = [tree("app"), gitlink("deps/submodule.py"), blob("app/main.py", 10)]
    assert languages_from_tree(entries) == {"Python": 10}


def test_ignores_symlinks() -> None:
    """A symlink is a blob whose content is its target path, not source."""
    entries = [symlink("shortcut.py"), blob("app/main.py", 10)]
    assert languages_from_tree(entries) == {"Python": 10}


def test_ignores_a_blob_with_no_size() -> None:
    assert languages_from_tree(
        [{"path": "a.py", "mode": "100644", "type": "blob"}, blob("b.py", 7)]
    ) == {"Python": 7}


def test_excludes_vendored_and_build_output() -> None:
    assert languages_from_tree(
        [
            blob("src/App.cs", 100),
            blob("node_modules/left-pad/index.js", 9999),
            blob("src/obj/Debug/Generated.cs", 9999),
            blob("ios/Pods/Sentry/Sentry.m", 9999),
        ]
    ) == {"C#": 100}


def test_excluded_segment_must_be_a_whole_directory() -> None:
    assert languages_from_tree([blob("build_tools/gen.py", 10), blob("app/binding.py", 5)]) == {
        "Python": 15
    }


def test_counts_test_code_like_linguist_does() -> None:
    assert languages_from_tree([blob("src/app.py", 100), blob("tests/test_app.py", 40)]) == {
        "Python": 140
    }


def test_ignores_unmapped_and_extensionless_files() -> None:
    assert (
        languages_from_tree(
            [blob("README.md"), blob("Makefile"), blob("go.sum"), blob("Pages/Index.razor")]
        )
        == {}
    )


def test_extension_matching_is_case_insensitive() -> None:
    assert languages_from_tree([blob("Program.CS", 10)]) == {"C#": 10}


def test_drops_languages_whose_files_are_all_empty() -> None:
    assert languages_from_tree([blob("empty.py", 0)]) == {}
