from __future__ import annotations

from sentry.integrations.cursor_origin.languages import languages_from_tree
from sentry.testutils.cases import TestCase


def blob(path: str, size: int = 100) -> dict[str, object]:
    return {"path": path, "type": "blob", "size": size, "sha": "x", "mode": "100644"}


def tree(path: str) -> dict[str, object]:
    return {"path": path, "type": "tree", "sha": "x", "mode": "040000"}


class LanguagesFromTreeTest(TestCase):
    def test_sums_bytes_per_language(self) -> None:
        assert languages_from_tree(
            [
                blob("app/main.py", 300),
                blob("app/util.py", 200),
                blob("web/index.ts", 50),
            ]
        ) == {"Python": 500, "TypeScript": 50}

    def test_uses_linguist_names_so_the_platform_registry_matches(self) -> None:
        # These keys must match GITHUB_LANGUAGE_TO_SENTRY_PLATFORM exactly, or
        # detection silently finds nothing.
        from sentry.integrations.github.platform_registry import (
            GITHUB_LANGUAGE_TO_SENTRY_PLATFORM,
        )

        detected = languages_from_tree(
            [blob("Api.cs"), blob("main.go"), blob("app.rb"), blob("lib.rs")]
        )
        assert set(detected) <= set(GITHUB_LANGUAGE_TO_SENTRY_PLATFORM)
        assert detected == {"C#": 100, "Go": 100, "Ruby": 100, "Rust": 100}

    def test_skips_trees_which_carry_no_size(self) -> None:
        assert languages_from_tree([tree("app"), blob("app/main.py", 10)]) == {"Python": 10}

    def test_excludes_vendored_and_build_output(self) -> None:
        # A checked-in node_modules or .NET obj/ directory would otherwise
        # drown out the actual application code.
        assert languages_from_tree(
            [
                blob("src/App.cs", 100),
                blob("node_modules/left-pad/index.js", 9999),
                blob("src/obj/Debug/Generated.cs", 9999),
            ]
        ) == {"C#": 100}

    def test_excludes_tests(self) -> None:
        assert languages_from_tree([blob("src/app.py", 100), blob("tests/test_app.py", 9999)]) == {
            "Python": 100
        }

    def test_ignores_unmapped_and_extensionless_files(self) -> None:
        assert languages_from_tree([blob("README.md"), blob("Makefile"), blob("go.sum")]) == {}

    def test_drops_languages_whose_files_are_all_empty(self) -> None:
        # A zero-weight language would register as a detected platform with no
        # evidence behind it.
        assert languages_from_tree([blob("empty.py", 0)]) == {}

    def test_extension_matching_is_case_insensitive(self) -> None:
        assert languages_from_tree([blob("Program.CS", 10)]) == {"C#": 10}

    def test_tolerates_a_stringified_size(self) -> None:
        # Origin serialises 64-bit ints as JSON strings in places -- `size` on
        # the contents route comes back as "2534". Tree entries use real ints
        # today, but a bare += would be a TypeError waiting to happen.
        assert languages_from_tree([{"path": "a.py", "type": "blob", "size": "300"}]) == {
            "Python": 300
        }

    def test_ignores_an_unparseable_size(self) -> None:
        assert languages_from_tree([{"path": "a.py", "type": "blob", "size": "big"}]) == {}

    def test_empty_tree(self) -> None:
        assert languages_from_tree([]) == {}
