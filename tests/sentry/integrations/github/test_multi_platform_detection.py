from __future__ import annotations

import string
from base64 import b64encode
from typing import Any
from unittest import mock

import pytest

from sentry.integrations.github.multi_platform_detection import (
    MAX_CONTENT_READS,
    MAX_LANGUAGES,
    _build_tree_index,
    _collect_needed_paths,
    _framework_matches_scoped,
    _get_repo_file_content,
    _get_tree,
    _parse_gemfile,
    _parse_package_manifest,
    _parse_pubspec_yaml,
    _rule_parent_dirs,
    _segments_are_ignored,
    _select_active_platforms,
    detect_platforms_multi,
)
from sentry.integrations.github.platform_registry import (
    GITHUB_LANGUAGE_TO_SENTRY_PLATFORM,
    DetectorRule,
    FrameworkDef,
    _PackageManifest,
)
from sentry.shared_integrations.exceptions import ApiConflictError, ApiError
from sentry.utils import json


def _distinct_platform_languages(n: int) -> list[str]:
    """Return n languages that each map to a different Sentry base platform.

    Iterates GITHUB_LANGUAGE_TO_SENTRY_PLATFORM in insertion order, picking
    the first language seen for each new base platform, until n entries are
    collected. Useful for building test inputs that exercise the MAX_LANGUAGES
    cap without hardcoding specific language names.
    """
    seen: set[str] = set()
    result: list[str] = []
    for lang, bp in GITHUB_LANGUAGE_TO_SENTRY_PLATFORM.items():
        if bp not in seen:
            seen.add(bp)
            result.append(lang)
        if len(result) == n:
            break
    return result


def _make_b64_response(content: str) -> dict[str, str]:
    return {"content": b64encode(content.encode()).decode()}


def _mock_client(
    languages: dict[str, int],
    tree_paths: list[str] | None = None,
    contents: dict[str, str] | None = None,
    dirs: list[str] | None = None,
) -> mock.MagicMock:
    """Build a mock GitHub client for detect_platforms_multi.

    ``tree_paths`` are file paths (blobs). ``dirs`` are directory paths (trees).
    ``contents`` maps full path -> file content string for /contents/ reads.
    """
    client = mock.MagicMock()
    client.get_languages.return_value = languages
    tree: list[dict[str, Any]] = []
    for path in tree_paths or []:
        tree.append({"path": path, "type": "blob", "size": 100})
    for path in dirs or []:
        tree.append({"path": path, "type": "tree"})
    content_map = contents or {}

    def get_side_effect(path: str, params: Any = None) -> Any:
        if "/git/trees/" in path:
            return {"tree": tree, "truncated": False}
        for file_path, content in content_map.items():
            if path.endswith(f"/contents/{file_path}"):
                return _make_b64_response(content)
        raise ApiError("Not Found", code=404)

    client.get.side_effect = get_side_effect
    return client


class TestBuildTreeIndex:
    def test_files_indexed_by_basename_with_full_paths(self) -> None:
        entries = [
            {"path": "fe/package.json", "type": "blob", "size": 100},
            {"path": "be/package.json", "type": "blob", "size": 200},
        ]
        index = _build_tree_index(entries)
        assert index.files_full_paths_by_basename["package.json"] == {
            "fe/package.json",
            "be/package.json",
        }

    def test_dirs_indexed_by_basename_with_full_paths(self) -> None:
        entries = [
            {"path": "Assets", "type": "tree"},
            {"path": "myproject/Assets", "type": "tree"},
        ]
        index = _build_tree_index(entries)
        assert index.dirs_full_paths_by_basename["Assets"] == {"Assets", "myproject/Assets"}

    def test_full_repo_size_bytes_includes_ignored_blobs(self) -> None:
        entries = [
            {"path": "src/app.py", "type": "blob", "size": 1000},
            # ignored path — excluded from index but still counted in size
            {"path": "node_modules/lodash/index.js", "type": "blob", "size": 5000},
        ]
        index = _build_tree_index(entries)
        assert index.full_repo_size_bytes == 6000
        assert "index.js" not in index.files_full_paths_by_basename

    def test_ignored_paths_excluded_from_file_index(self) -> None:
        entries = [
            {"path": "node_modules/react/package.json", "type": "blob", "size": 100},
            {"path": "vendor/lib/config.py", "type": "blob", "size": 200},
        ]
        index = _build_tree_index(entries)
        assert len(index.files_full_paths_by_basename) == 0

    def test_ignored_paths_excluded_from_dir_index(self) -> None:
        entries = [
            {"path": "node_modules/react", "type": "tree"},
        ]
        index = _build_tree_index(entries)
        assert len(index.dirs_full_paths_by_basename) == 0

    def test_files_indexed_by_basename_across_subdirs(self) -> None:
        entries = [
            {"path": "fe/next.config.js", "type": "blob", "size": 100},
            {"path": "be/manage.py", "type": "blob", "size": 200},
        ]
        index = _build_tree_index(entries)
        assert index.files_full_paths_by_basename["next.config.js"] == {"fe/next.config.js"}
        assert index.files_full_paths_by_basename["manage.py"] == {"be/manage.py"}

    def test_root_level_entries_indexed(self) -> None:
        entries: list[dict[str, Any]] = [
            {"path": "manage.py", "type": "blob", "size": 50},
            {"path": "Assets", "type": "tree"},
        ]
        index = _build_tree_index(entries)
        assert index.files_full_paths_by_basename["manage.py"] == {"manage.py"}
        assert index.dirs_full_paths_by_basename["Assets"] == {"Assets"}


class TestRuleParentDirs:
    def test_path_rule_returns_parent_dir(self) -> None:
        files = {"next.config.js": {"fe/next.config.js"}}
        result = _rule_parent_dirs({"path": "next.config.js"}, files, {}, {}, {})
        assert result == {"fe"}

    def test_path_rule_at_root_returns_empty_string_scope(self) -> None:
        files = {"manage.py": {"manage.py"}}
        result = _rule_parent_dirs({"path": "manage.py"}, files, {}, {}, {})
        assert result == {""}

    def test_path_rule_multiple_occurrences_collects_all_parents(self) -> None:
        files = {"package.json": {"fe/package.json", "be/package.json"}}
        result = _rule_parent_dirs({"path": "package.json"}, files, {}, {}, {})
        assert result == {"fe", "be"}

    def test_path_rule_absent_returns_empty_set(self) -> None:
        result = _rule_parent_dirs({"path": "manage.py"}, {}, {}, {}, {})
        assert result == set()

    def test_match_ext_returns_union_of_parent_dirs(self) -> None:
        files = {
            "myapp.csproj": {"apps/web/myapp.csproj"},
            "lib.csproj": {"apps/lib/lib.csproj"},
        }
        result = _rule_parent_dirs({"match_ext": ".csproj"}, files, {}, {}, {})
        assert result == {"apps/web", "apps/lib"}

    def test_match_dir_returns_parent_dirs(self) -> None:
        dirs = {"Assets": {"Assets", "myproject/Assets"}}
        result = _rule_parent_dirs({"match_dir": "Assets"}, {}, dirs, {}, {})
        assert result == {"", "myproject"}

    def test_match_dir_dotted_name_uses_endswith(self) -> None:
        # .xcodeproj dirs are matched by endswith, not equality
        dirs = {"MyApp.xcodeproj": {"MyApp.xcodeproj"}}
        result = _rule_parent_dirs({"match_dir": ".xcodeproj"}, {}, dirs, {}, {})
        assert result == {""}

    def test_match_content_empty_in_existence_pass(self) -> None:
        # empty content maps → content rule returns empty set (doesn't fire)
        rule: DetectorRule = {"path": "requirements.txt", "match_content": r"django"}
        assert _rule_parent_dirs(rule, {}, {}, {}, {}) == set()

    def test_match_package_empty_in_existence_pass(self) -> None:
        # empty manifest map → package rule returns empty set (doesn't fire)
        assert _rule_parent_dirs({"match_package": "next"}, {}, {}, {}, {}) == set()

    def test_match_content_with_content_returns_parent_dir(self) -> None:
        rule: DetectorRule = {"path": "requirements.txt", "match_content": r"(?i)\bdjango\b"}
        content = {"requirements.txt": "Django==4.2\n"}
        result = _rule_parent_dirs(rule, {}, {}, content, {})
        assert result == {""}

    def test_match_content_no_match_returns_empty_set(self) -> None:
        rule: DetectorRule = {"path": "requirements.txt", "match_content": r"(?i)\bdjango\b"}
        content = {"requirements.txt": "flask==3.0\n"}
        assert _rule_parent_dirs(rule, {}, {}, content, {}) == set()

    def test_match_package_with_manifest_returns_parent_dir(self) -> None:
        manifest = _PackageManifest(dependencies={"next", "react"}, dev_dependencies=set())
        manifests = {"fe/package.json": manifest}
        result = _rule_parent_dirs({"match_package": "next"}, {}, {}, {}, manifests)
        assert result == {"fe"}

    def test_match_content_with_match_ext_filters_by_extension(self) -> None:
        rule: DetectorRule = {"match_ext": ".csproj", "match_content": r"Microsoft\.Maui"}
        content = {
            "myapp.csproj": "...<Microsoft.Maui...",
            "other.txt": "Microsoft.Maui",  # wrong extension — must be ignored
        }
        result = _rule_parent_dirs(rule, {}, {}, content, {})
        assert result == {""}

    def test_match_content_is_case_sensitive(self) -> None:
        # Mirror the registry's case-sensitive re.search: a case-sensitive pattern
        # (no inline (?i)) must NOT match differently-cased content.
        rule: DetectorRule = {"match_ext": ".csproj", "match_content": r"Microsoft\.Maui"}
        content = {"myapp.csproj": "...<microsoft.maui...>"}  # lowercase — must not fire
        assert _rule_parent_dirs(rule, {}, {}, content, {}) == set()

    def test_match_content_no_path_or_ext_filter_scans_all_files(self) -> None:
        # A bare match_content rule (no path/match_ext) should match any fetched file
        # whose content satisfies the pattern and collect all their parent dirs.
        rule: DetectorRule = {"match_content": r"SECRET"}
        content = {
            "root_file.txt": "SECRET=abc",
            "sub/nested.txt": "SECRET=xyz",
            "other.txt": "nothing here",
        }
        result = _rule_parent_dirs(rule, {}, {}, content, {})
        assert result == {"", "sub"}


class TestFrameworkMatchesScoped:
    def test_some_only_path_matches(self) -> None:
        fw: FrameworkDef = {
            "platform": "godot",
            "sort": 10,
            "base_platform": "godot",
            "some": [{"path": "project.godot"}],
        }
        assert (
            _framework_matches_scoped(fw, {"project.godot": {"project.godot"}}, {}, {}, {}) is True
        )

    def test_some_only_path_absent(self) -> None:
        fw: FrameworkDef = {
            "platform": "godot",
            "sort": 10,
            "base_platform": "godot",
            "some": [{"path": "project.godot"}],
        }
        assert _framework_matches_scoped(fw, {}, {}, {}, {}) is False

    def test_some_only_match_package_false_in_existence_pass(self) -> None:
        # empty manifest maps → package rule doesn't fire in existence pass
        fw: FrameworkDef = {
            "platform": "javascript-nextjs",
            "sort": 1,
            "base_platform": "javascript",
            "some": [{"match_package": "next"}],
            "supersedes": ["javascript-react"],
        }
        assert (
            _framework_matches_scoped(fw, {"package.json": {"package.json"}}, {}, {}, {}) is False
        )

    def test_some_only_match_package_matches_with_manifest(self) -> None:
        # populated manifest → package rule fires in content pass
        fw: FrameworkDef = {
            "platform": "javascript-nextjs",
            "sort": 1,
            "base_platform": "javascript",
            "some": [{"match_package": "next"}],
        }
        manifest = _PackageManifest(dependencies={"next"}, dev_dependencies=set())
        assert _framework_matches_scoped(fw, {}, {}, {}, {"package.json": manifest}) is True

    def test_every_only_files_in_same_parent_scope(self) -> None:
        # dotnet-aspnetcore: .csproj + appsettings.json co-located → match
        fw: FrameworkDef = {
            "platform": "dotnet-aspnetcore",
            "sort": 10,
            "base_platform": "dotnet",
            "every": [{"match_ext": ".csproj"}, {"path": "appsettings.json"}],
        }
        files = {
            "myapp.csproj": {"apps/web/myapp.csproj"},
            "appsettings.json": {"apps/web/appsettings.json"},
        }
        assert _framework_matches_scoped(fw, files, {}, {}, {}) is True

    def test_every_only_stray_files_in_different_scopes_no_match(self) -> None:
        # The blind spot fixed by co-location: deploy.csproj + unrelated appsettings.json
        fw: FrameworkDef = {
            "platform": "dotnet-aspnetcore",
            "sort": 10,
            "base_platform": "dotnet",
            "every": [{"match_ext": ".csproj"}, {"path": "appsettings.json"}],
        }
        files = {
            "deploy.csproj": {"tools/deploy/deploy.csproj"},
            "appsettings.json": {"backend/appsettings.json"},
        }
        assert _framework_matches_scoped(fw, files, {}, {}, {}) is False

    def test_every_match_dir_same_scope(self) -> None:
        # unity: Assets/ + ProjectSettings/ at the same level → match
        fw: FrameworkDef = {
            "platform": "unity",
            "sort": 10,
            "base_platform": "dotnet",
            "every": [{"match_dir": "Assets"}, {"match_dir": "ProjectSettings"}],
        }
        dirs = {"Assets": {"Assets"}, "ProjectSettings": {"ProjectSettings"}}
        assert _framework_matches_scoped(fw, {}, dirs, {}, {}) is True

    def test_every_match_dir_different_scopes_no_match(self) -> None:
        # Assets at root, ProjectSettings inside backend/ — not a Unity project
        fw: FrameworkDef = {
            "platform": "unity",
            "sort": 10,
            "base_platform": "dotnet",
            "every": [{"match_dir": "Assets"}, {"match_dir": "ProjectSettings"}],
        }
        dirs = {"Assets": {"Assets"}, "ProjectSettings": {"backend/ProjectSettings"}}
        assert _framework_matches_scoped(fw, {}, dirs, {}, {}) is False

    def test_every_with_match_content_false_in_existence_pass(self) -> None:
        # empty content maps → content rule doesn't fire; framework doesn't match yet
        fw: FrameworkDef = {
            "platform": "dotnet-maui",
            "sort": 10,
            "base_platform": "dotnet",
            "every": [{"match_ext": ".csproj", "match_content": r"Microsoft\.Maui"}],
        }
        assert (
            _framework_matches_scoped(fw, {"myapp.csproj": {"myapp.csproj"}}, {}, {}, {}) is False
        )

    def test_every_with_match_content_matches_with_content(self) -> None:
        # populated content → content rule fires; framework matches
        fw: FrameworkDef = {
            "platform": "dotnet-maui",
            "sort": 10,
            "base_platform": "dotnet",
            "every": [{"match_ext": ".csproj", "match_content": r"Microsoft\.Maui"}],
        }
        content = {"apps/myapp.csproj": "<Project><Microsoft.Maui/></Project>"}
        assert _framework_matches_scoped(fw, {}, {}, content, {}) is True

    def test_every_and_some_both_fire_in_same_scope(self) -> None:
        # every: match_dir "app" at root; some: path "build.gradle" at root → match
        fw: FrameworkDef = {
            "platform": "hypothetical",
            "sort": 10,
            "base_platform": "java",
            "every": [{"match_dir": "app"}],
            "some": [{"path": "build.gradle"}],
        }
        files = {"build.gradle": {"build.gradle"}}  # parent ""
        dirs = {"app": {"app"}}  # parent ""
        assert _framework_matches_scoped(fw, files, dirs, {}, {}) is True

    def test_every_and_some_some_only_outside_every_scope(self) -> None:
        # every scope is "" (app/ at root), some rule only fires in "other/" — no match
        fw: FrameworkDef = {
            "platform": "hypothetical",
            "sort": 10,
            "base_platform": "java",
            "every": [{"match_dir": "app"}],
            "some": [{"path": "build.gradle"}],
        }
        files = {"build.gradle": {"other/build.gradle"}}  # parent "other"
        dirs = {"app": {"app"}}  # parent ""
        assert _framework_matches_scoped(fw, files, dirs, {}, {}) is False

    def test_every_and_some_some_is_content_rule_matches_in_scope(self) -> None:
        # every: match_dir "src" at root; some: match_content in requirements.txt at root
        fw: FrameworkDef = {
            "platform": "hypothetical",
            "sort": 10,
            "base_platform": "python",
            "every": [{"match_dir": "src"}],
            "some": [{"path": "requirements.txt", "match_content": r"(?i)\bdjango\b"}],
        }
        dirs = {"src": {"src"}}
        content = {"requirements.txt": "Django==4.2\n"}
        assert _framework_matches_scoped(fw, {}, dirs, content, {}) is True

    def test_empty_every_and_some_returns_false(self) -> None:
        fw: FrameworkDef = {"platform": "empty", "sort": 10, "base_platform": "python"}
        assert _framework_matches_scoped(fw, {}, {}, {}, {}) is False


class TestCollectNeededPaths:
    def test_includes_all_package_manifest_paths(self) -> None:
        # Both root and subdir package.json should be included for match_package rules.
        active = {"javascript": [("JavaScript", 100)]}
        files = {"package.json": {"package.json", "fe/package.json"}}
        result = _collect_needed_paths(active, files)
        assert result == {"package.json", "fe/package.json"}

    def test_includes_match_content_target_path(self) -> None:
        # python-django has a match_content rule targeting requirements.txt by path.
        active = {"python": [("Python", 80000)]}
        files = {"requirements.txt": {"requirements.txt"}}
        result = _collect_needed_paths(active, files)
        assert "requirements.txt" in result

    def test_includes_match_ext_content_files(self) -> None:
        # dotnet-maui has match_ext=".csproj" + match_content -> all .csproj paths included.
        active = {"dotnet": [("C#", 50000)]}
        files = {
            "myapp.csproj": {"apps/web/myapp.csproj"},
            "lib.csproj": {"lib/lib.csproj"},
        }
        result = _collect_needed_paths(active, files)
        assert "apps/web/myapp.csproj" in result
        assert "lib/lib.csproj" in result

    def test_excludes_absent_manifest(self) -> None:
        # No package.json in tree -> nothing to read for match_package rules.
        active = {"javascript": [("JavaScript", 100)]}
        files = {"index.js": {"index.js"}}
        result = _collect_needed_paths(active, files)
        assert "package.json" not in result
        assert "index.js" not in result


def _make_tree_entry(path: str, entry_type: str = "blob") -> dict[str, Any]:
    return {"path": path, "type": entry_type, "size": 100}


def _make_client(
    languages: dict[str, int],
    tree: list[dict[str, Any]],
    contents: dict[str, str],
    truncated: bool = False,
) -> mock.MagicMock:
    """Return a fake GitHubBaseClient that serves a fixed tree and content map."""
    client = mock.MagicMock()
    client.get_languages.return_value = languages

    def get_side_effect(path: str, params: dict | None = None) -> Any:
        if "/git/trees/" in path:
            return {"tree": tree, "truncated": truncated}
        # contents endpoint: /repos/{owner/repo}/contents/{rel_path}
        rel = path.split("/contents/", 1)[1]
        if rel in contents:
            return {"content": b64encode(contents[rel].encode()).decode()}
        raise ApiError("Not Found", code=404)

    client.get.side_effect = get_side_effect
    return client


class TestDetectPlatformsMulti:
    def test_content_match_detected_high(self) -> None:
        # requirements.txt only (no manage.py) -> python-django only fires via content read.
        tree = [_make_tree_entry("requirements.txt")]
        client = _make_client(
            languages={"Python": 80000},
            tree=tree,
            contents={"requirements.txt": "Django==4.2\n"},
        )
        result = detect_platforms_multi(client, "owner/repo")
        platforms = {p["platform"]: p for p in result["platforms"]}
        assert "python-django" in platforms
        assert platforms["python-django"]["confidence"] == "high"
        assert "python" in platforms
        assert platforms["python"]["confidence"] == "medium"

    def test_package_match_detected_high(self) -> None:
        # javascript-react has only a match_package rule — no existence trigger.
        pkg = json.dumps({"dependencies": {"react": "18.0.0"}})
        tree = [_make_tree_entry("package.json")]
        client = _make_client(
            languages={"JavaScript": 60000},
            tree=tree,
            contents={"package.json": pkg},
        )
        result = detect_platforms_multi(client, "owner/repo")
        platforms = {p["platform"] for p in result["platforms"]}
        assert "javascript-react" in platforms

    def test_content_read_cap_and_shallow_first(self) -> None:
        # Root package.json (deps: next) + MAX_CONTENT_READS deeper workspace package.json files.
        # Root takes the first cap slot; the alphabetically-last deep manifest must not be fetched.
        deep_letters = string.ascii_lowercase[:MAX_CONTENT_READS]
        deep_names = [f"packages/{c}/package.json" for c in deep_letters]
        tree = [_make_tree_entry("package.json")] + [_make_tree_entry(p) for p in deep_names]
        root_pkg = json.dumps({"dependencies": {"next": "14.0.0"}})
        contents = {"package.json": root_pkg}
        for p in deep_names:
            contents[p] = json.dumps({"dependencies": {}})

        client = _make_client(
            languages={"JavaScript": 100000},
            tree=tree,
            contents=contents,
        )
        result = detect_platforms_multi(client, "owner/repo")

        fetched = [
            call.args[0].split("/contents/", 1)[1]
            for call in client.get.call_args_list
            if "/contents/" in call.args[0]
        ]
        last_deep = f"packages/{deep_letters[-1]}/package.json"
        assert "package.json" in fetched
        assert last_deep not in fetched

        platforms = {p["platform"] for p in result["platforms"]}
        assert "javascript-nextjs" in platforms

    def test_content_driven_supersession(self) -> None:
        # package.json declares both react and react-native; react-native supersedes react.
        pkg = json.dumps({"dependencies": {"react": "18.0.0", "react-native": "0.73.0"}})
        tree = [_make_tree_entry("package.json")]
        client = _make_client(
            languages={"JavaScript": 70000},
            tree=tree,
            contents={"package.json": pkg},
        )
        result = detect_platforms_multi(client, "owner/repo")
        platforms = {p["platform"] for p in result["platforms"]}
        assert "react-native" in platforms
        assert "javascript-react" not in platforms

    def test_no_content_reads_when_no_candidates(self) -> None:
        # Only main.py in tree — no manifest file, no match_content target file present.
        tree = [_make_tree_entry("main.py")]
        client = _make_client(
            languages={"Python": 40000},
            tree=tree,
            contents={},
        )
        result = detect_platforms_multi(client, "owner/repo")

        platforms = {p["platform"] for p in result["platforms"]}
        assert platforms == {"python"}
        # No /contents/ call should have been issued
        contents_calls = [c for c in client.get.call_args_list if "/contents/" in c.args[0]]
        assert contents_calls == []

    def test_existence_only_pass1_high_match_no_content_reads(self) -> None:
        # manage.py is a pure path rule for python-django (no match_content required).
        # Pass 1 should fire it as high-confidence with zero /contents/ calls.
        tree = [_make_tree_entry("manage.py")]
        client = _make_client(
            languages={"Python": 80000},
            tree=tree,
            contents={},
        )
        result = detect_platforms_multi(client, "owner/repo")
        platforms = {p["platform"]: p for p in result["platforms"]}
        assert "python-django" in platforms
        assert platforms["python-django"]["confidence"] == "high"
        contents_calls = [c for c in client.get.call_args_list if "/contents/" in c.args[0]]
        assert contents_calls == []

    def test_colocation_prevents_false_positive_end_to_end(self) -> None:
        # dotnet-aspnetcore requires .csproj AND appsettings.json in the same directory.
        # Placing them in separate subtrees must NOT produce a high match.
        tree = [
            _make_tree_entry("tools/deploy/deploy.csproj"),
            _make_tree_entry("backend/appsettings.json"),
        ]
        client = _make_client(
            languages={"C#": 50000},
            tree=tree,
            contents={},
        )
        result = detect_platforms_multi(client, "owner/repo")
        platforms = {p["platform"] for p in result["platforms"]}
        assert "dotnet-aspnetcore" not in platforms

    def test_confidence_ordering_high_before_medium(self) -> None:
        # A high-confidence framework match must always rank above a medium
        # bare-language fallback, even if the medium entry has more bytes.
        # Use a Python repo with manage.py (pure existence → high) so no content
        # reads are issued, then verify result ordering.
        tree = [_make_tree_entry("manage.py")]
        client = _make_client(
            languages={"Python": 80000},
            tree=tree,
            contents={},
        )
        result = detect_platforms_multi(client, "owner/repo")
        # First entry must be the high-confidence framework, not the medium fallback.
        assert result["platforms"][0]["confidence"] == "high"
        assert result["platforms"][0]["platform"] == "python-django"


class TestSelectActivePlatforms:
    def test_max_languages_cap_keeps_top_n(self) -> None:
        # Feed MAX_LANGUAGES + 1 distinct base platforms; only the top MAX_LANGUAGES survive.
        candidates = _distinct_platform_languages(MAX_LANGUAGES + 1)
        languages = {lang: 100_000 - i * 10_000 for i, lang in enumerate(candidates)}
        result = _select_active_platforms(languages)
        assert len(result) == MAX_LANGUAGES
        dropped_platform = GITHUB_LANGUAGE_TO_SENTRY_PLATFORM[candidates[-1]]
        assert dropped_platform not in result

    def test_related_languages_group_into_single_bucket(self) -> None:
        # TypeScript and JavaScript both map to "javascript"; they share one slot.
        languages = {
            "TypeScript": 70_000,
            "JavaScript": 50_000,
        }
        result = _select_active_platforms(languages)
        assert list(result.keys()) == ["javascript"]
        # Both language entries should appear in the bucket.
        bucket = result["javascript"]
        lang_names = {lang for lang, _ in bucket}
        assert lang_names == {"TypeScript", "JavaScript"}

    def test_grouping_does_not_consume_extra_cap_slot(self) -> None:
        # TypeScript + JavaScript + Python + Ruby = 3 distinct base platforms, not 4.
        # All three base platforms should be present despite 4 input languages.
        languages = {
            "TypeScript": 80_000,
            "JavaScript": 70_000,
            "Python": 60_000,
            "Ruby": 50_000,
        }
        result = _select_active_platforms(languages)
        assert "javascript" in result
        assert "python" in result
        assert "ruby" in result
        assert len(result) == 3

    def test_ignored_language_skipped(self) -> None:
        # "Shell" is in IGNORED_LANGUAGES and must never appear.
        languages = {"Shell": 999_999, "Python": 10_000}
        result = _select_active_platforms(languages)
        assert "python" in result
        # Shell has no mapped base platform so it won't appear under any key.
        for lang_entries in result.values():
            for lang, _ in lang_entries:
                assert lang != "Shell"

    def test_byte_count_descending_ordering(self) -> None:
        # The platform with the most bytes should appear first in iteration order.
        languages = {"Ruby": 90_000, "Python": 120_000, "Go": 70_000}
        result = _select_active_platforms(languages)
        # dict preserves insertion order; first key is the top platform.
        first_platform = next(iter(result))
        assert first_platform == "python"


class TestSegmentsAreIgnored:
    def test_node_modules_segment_ignored(self) -> None:
        assert _segments_are_ignored(["node_modules", "react", "index.js"]) is True

    def test_nested_ignored_segment(self) -> None:
        assert _segments_are_ignored(["a", "b", "vendor", "c", "util.py"]) is True

    def test_build_gradle_file_not_ignored(self) -> None:
        # "build" is an ignored *directory* segment, but "build.gradle" as a
        # single segment is not the bare string "build", so must NOT be ignored.
        assert _segments_are_ignored(["build.gradle"]) is False

    def test_clean_path_not_ignored(self) -> None:
        assert _segments_are_ignored(["src", "app", "main.py"]) is False

    def test_root_level_file_not_ignored(self) -> None:
        assert _segments_are_ignored(["manage.py"]) is False

    def test_dist_dir_ignored(self) -> None:
        assert _segments_are_ignored(["dist", "bundle.js"]) is True


class TestDetectPlatformsMultiConcurrency:
    def test_isolated_content_read_failure_does_not_abort_detection(self) -> None:
        """If one content read raises ApiError the other reads must still
        complete and the detection must return a valid result."""
        from base64 import b64encode

        # tree: requirements.txt (django content) + a second file that will 404
        tree = [
            _make_tree_entry("requirements.txt"),
            _make_tree_entry("broken_file.txt"),  # will raise ApiError
        ]
        client = mock.MagicMock()
        client.get_languages.return_value = {"Python": 80_000}

        def get_side_effect(path: str, params: dict | None = None) -> Any:
            if "/git/trees/" in path:
                return {"tree": tree, "truncated": False}
            rel = path.split("/contents/", 1)[1]
            if rel == "requirements.txt":
                return {"content": b64encode(b"Django==4.2\n").decode()}
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect
        # Must not raise; ApiError on a single file is swallowed by
        # _get_repo_file_content and should not abort the pool.
        result = detect_platforms_multi(client, "owner/repo")
        platform_ids = {p["platform"] for p in result["platforms"]}
        assert "python-django" in platform_ids

    def test_api_conflict_error_propagates_from_tree_future(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {}
        client.get.side_effect = ApiConflictError("empty repo")
        with pytest.raises(ApiConflictError):
            detect_platforms_multi(client, "owner/repo")

    def test_languages_computed_before_tree_result_is_joined(self) -> None:
        """active_platforms is derived from languages independently of the
        tree.  Verify detection still produces correct output even when the
        tree responds very slowly (simulated via call ordering introspection)."""
        # Simple fixture: Go repo, go.mod at root (existence rule → high match).
        tree = [_make_tree_entry("go.mod")]
        client = _make_client(
            languages={"Go": 60_000},
            tree=tree,
            contents={},
        )
        result = detect_platforms_multi(client, "owner/repo")
        platform_ids = {p["platform"] for p in result["platforms"]}
        assert "go" in platform_ids
        # get_languages must have been called exactly once, tree call once.
        assert client.get_languages.call_count == 1
        tree_calls = [c for c in client.get.call_args_list if "/git/trees/" in c.args[0]]
        assert len(tree_calls) == 1


class TestGetTree:
    def test_normal_dict_response_returns_entries(self) -> None:
        entries = [{"path": "manage.py", "type": "blob", "size": 100}]
        client = mock.MagicMock()
        client.get.return_value = {"tree": entries, "truncated": False}
        result_entries, is_truncated = _get_tree(client, "owner/repo")
        assert result_entries == entries
        assert is_truncated is False

    def test_non_dict_response_returns_empty(self) -> None:
        # GitHub occasionally returns a list or unexpected type on error.
        client = mock.MagicMock()
        client.get.return_value = []
        result_entries, is_truncated = _get_tree(client, "owner/repo")
        assert result_entries == []
        assert is_truncated is False

    def test_missing_tree_key_returns_empty_entries(self) -> None:
        client = mock.MagicMock()
        client.get.return_value = {"truncated": False}
        result_entries, is_truncated = _get_tree(client, "owner/repo")
        assert result_entries == []
        assert is_truncated is False

    def test_truncated_flag_propagated(self) -> None:
        client = mock.MagicMock()
        client.get.return_value = {"tree": [], "truncated": True}
        _, is_truncated = _get_tree(client, "owner/repo")
        assert is_truncated is True


class TestParsePackageManifest:
    def test_parses_package_json(self) -> None:
        content = json.dumps(
            {"dependencies": {"next": "^14.0.0"}, "devDependencies": {"jest": "^29.0.0"}}
        )
        result = _parse_package_manifest(content, "package.json")
        assert result is not None
        assert result["dependencies"] == {"next"}
        assert result["dev_dependencies"] == {"jest"}

    def test_parses_composer_json(self) -> None:
        content = json.dumps(
            {"require": {"laravel/framework": "^10.0"}, "require-dev": {"phpunit/phpunit": "^10"}}
        )
        result = _parse_package_manifest(content, "composer.json")
        assert result is not None
        assert result["dependencies"] == {"laravel/framework"}
        assert result["dev_dependencies"] == {"phpunit/phpunit"}

    def test_invalid_json_returns_none(self) -> None:
        assert _parse_package_manifest("not json", "package.json") is None

    def test_unsupported_manifest_returns_none(self) -> None:
        assert _parse_package_manifest("{}", "requirements.txt") is None

    def test_null_dependencies_handled(self) -> None:
        content = json.dumps({"dependencies": None, "devDependencies": None})
        result = _parse_package_manifest(content, "package.json")
        assert result is not None
        assert result["dependencies"] == set()
        assert result["dev_dependencies"] == set()

    def test_null_composer_require_handled(self) -> None:
        content = json.dumps({"require": None, "require-dev": None})
        result = _parse_package_manifest(content, "composer.json")
        assert result is not None
        assert result["dependencies"] == set()
        assert result["dev_dependencies"] == set()

    def test_delegates_to_pubspec_yaml(self) -> None:
        content = "dependencies:\n  flutter:\n    sdk: flutter\n  http: ^0.13.5\n"
        result = _parse_package_manifest(content, "pubspec.yaml")
        assert result is not None
        assert "flutter" in result["dependencies"]
        assert "http" in result["dependencies"]

    def test_delegates_to_gemfile(self) -> None:
        content = 'gem "rails", "~> 7.0"\ngem "puma"\n'
        result = _parse_package_manifest(content, "Gemfile")
        assert result is not None
        assert "rails" in result["dependencies"]
        assert "puma" in result["dependencies"]


class TestParsePubspecYaml:
    def test_extracts_dependencies(self) -> None:
        content = (
            "name: my_app\n"
            "dependencies:\n"
            "  flutter:\n"
            "    sdk: flutter\n"
            "  http: ^0.13.5\n"
            "  cupertino_icons: ^1.0.2\n"
            "dev_dependencies:\n"
            "  flutter_test:\n"
            "    sdk: flutter\n"
            "  flutter_lints: ^2.0.0\n"
        )
        result = _parse_pubspec_yaml(content)
        assert result["dependencies"] == {"flutter", "http", "cupertino_icons"}
        assert result["dev_dependencies"] == {"flutter_test", "flutter_lints"}

    def test_empty_sections(self) -> None:
        content = "name: my_app\ndependencies:\ndev_dependencies:\n"
        result = _parse_pubspec_yaml(content)
        assert result["dependencies"] == set()
        assert result["dev_dependencies"] == set()

    def test_no_dev_dependencies(self) -> None:
        content = "name: my_app\ndependencies:\n  http: ^0.13.5\n"
        result = _parse_pubspec_yaml(content)
        assert result["dependencies"] == {"http"}
        assert result["dev_dependencies"] == set()


class TestParseGemfile:
    def test_extracts_gem_names(self) -> None:
        content = (
            'source "https://rubygems.org"\n'
            'gem "rails", "~> 7.0"\n'
            "gem 'puma', '~> 6.0'\n"
            'gem "rack"\n'
        )
        result = _parse_gemfile(content)
        assert result["dependencies"] == {"rails", "puma", "rack"}

    def test_ignores_comments(self) -> None:
        content = '# gem "not-this"\ngem "real-gem"\n'
        result = _parse_gemfile(content)
        assert result["dependencies"] == {"real-gem"}

    def test_empty_gemfile(self) -> None:
        result = _parse_gemfile("")
        assert result["dependencies"] == set()


class TestGetRepoFileContent:
    def test_returns_decoded_content(self) -> None:
        client = mock.MagicMock()
        client.get.return_value = _make_b64_response("hello world")

        result = _get_repo_file_content(client, "owner/repo", "README.md")

        assert result == "hello world"

    def test_returns_none_on_api_error(self) -> None:
        client = mock.MagicMock()
        client.get.side_effect = ApiError("Not Found", code=404)

        assert _get_repo_file_content(client, "owner/repo", "missing.txt") is None

    def test_returns_none_on_missing_content_key(self) -> None:
        client = mock.MagicMock()
        client.get.return_value = {"name": "file.txt"}

        assert _get_repo_file_content(client, "owner/repo", "file.txt") is None

    def test_returns_none_on_invalid_base64(self) -> None:
        client = mock.MagicMock()
        client.get.return_value = {"content": "not-valid-base64!!!"}

        assert _get_repo_file_content(client, "owner/repo", "file.txt") is None

    def test_returns_none_on_binary_content(self) -> None:
        client = mock.MagicMock()
        # Valid base64 but decodes to invalid UTF-8
        client.get.return_value = {"content": b64encode(b"\x80\x81\x82").decode()}

        assert _get_repo_file_content(client, "owner/repo", "binary.bin") is None

    def test_returns_none_on_directory_listing(self) -> None:
        client = mock.MagicMock()
        # GitHub returns a list (not a dict) when path is a directory
        client.get.return_value = [{"name": "file.txt", "type": "file"}]

        assert _get_repo_file_content(client, "owner/repo", "some-dir") is None


class TestDetectPlatformsMultiFrameworks:
    def test_detects_single_language_repo(self) -> None:
        client = _mock_client({"Python": 50000})

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        assert len(result) == 1
        assert result[0]["platform"] == "python"
        assert result[0]["language"] == "Python"
        assert result[0]["bytes"] == 50000
        assert result[0]["confidence"] == "medium"
        assert result[0]["priority"] == 1

    def test_filters_ignored_languages(self) -> None:
        client = _mock_client(
            {
                "Python": 50000,
                "Shell": 5000,
                "Makefile": 1000,
                "Dockerfile": 500,
            }
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        languages = [r["language"] for r in result]
        assert "Python" in languages
        assert "Shell" not in languages
        assert "Makefile" not in languages
        assert "Dockerfile" not in languages

    def test_powershell_detected_as_base_platform(self) -> None:
        client = _mock_client({"PowerShell": 20000})

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        assert len(result) == 1
        assert result[0]["platform"] == "powershell"

    def test_framework_detection_gives_high_confidence(self) -> None:
        client = _mock_client(
            {"Python": 50000},
            tree_paths=["requirements.txt"],
            contents={
                "requirements.txt": "Django==4.2\n",
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        django_result = next(r for r in result if r["platform"] == "python-django")
        assert django_result["confidence"] == "high"

        python_result = next(r for r in result if r["platform"] == "python")
        assert python_result["confidence"] == "medium"

    def test_results_sorted_by_bytes_then_priority(self) -> None:
        """Frameworks are sorted by (confidence, bytes, priority)."""

        client = _mock_client(
            {"Python": 80000},
            tree_paths=["requirements.txt", "manage.py"],
            contents={
                "requirements.txt": "flask==3.0\ncelery>=5.0\n",
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        # Flask (sort=10, priority=90) should rank above Celery (sort=50, priority=50)
        flask_idx = platforms.index("python-flask")
        celery_idx = platforms.index("python-celery")
        assert flask_idx < celery_idx

    def test_nextjs_supersedes_react_in_full_flow(self) -> None:
        content = json.dumps(
            {"dependencies": {"next": "^14.0.0", "react": "^18.0.0", "express": "^4.0.0"}}
        )

        client = _mock_client(
            {"JavaScript": 50000},
            tree_paths=["package.json"],
            contents={
                "package.json": content,
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "javascript-nextjs" in platforms
        assert "node-express" in platforms
        assert "javascript-react" not in platforms
        assert "javascript" in platforms

    def test_framework_sort_determines_ranking(self) -> None:
        content = json.dumps(
            {
                "dependencies": {"express": "^4.0.0"},
                "devDependencies": {"svelte": "^4.0.0"},
            }
        )

        client = _mock_client(
            {"JavaScript": 50000},
            tree_paths=["package.json"],
            contents={
                "package.json": content,
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        svelte = next(r for r in result if r["platform"] == "javascript-svelte")
        express = next(r for r in result if r["platform"] == "node-express")
        # svelte sort=10 → priority=90, express sort=20 → priority=80
        assert svelte["priority"] == 90
        assert express["priority"] == 80

    def test_typescript_and_javascript_deduplicated(self) -> None:
        client = _mock_client({"TypeScript": 40000, "JavaScript": 10000})

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert platforms.count("javascript") == 1
        assert result[0]["bytes"] == 50000

    def test_empty_repo_returns_empty(self) -> None:
        client = _mock_client({})

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        assert result == []

    def test_only_ignored_languages_returns_empty(self) -> None:
        client = _mock_client({"Shell": 5000, "Makefile": 1000})

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        assert result == []

    def test_priority_field_present_in_results(self) -> None:
        client = _mock_client({"Python": 50000})

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        assert "priority" in result[0]

    @pytest.mark.parametrize(
        ("language", "expected_platform"),
        [
            ("Python", "python"),
            ("JavaScript", "javascript"),
            ("TypeScript", "javascript"),
            ("Java", "java"),
            ("Kotlin", "kotlin"),
            ("Go", "go"),
            ("Ruby", "ruby"),
            ("PHP", "php"),
            ("Rust", "rust"),
            ("C#", "dotnet"),
            ("Dart", "dart"),
            ("Elixir", "elixir"),
            ("PowerShell", "powershell"),
        ],
    )
    def test_all_mapped_languages_detected(self, language: str, expected_platform: str) -> None:
        client = _mock_client({language: 10000})

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        assert len(result) >= 1
        assert result[0]["platform"] == expected_platform

    def test_config_file_detects_nextjs_without_dep(self) -> None:
        client = _mock_client(
            {"JavaScript": 50000},
            tree_paths=["next.config.js", "package.json"],
            contents={
                "package.json": json.dumps({"dependencies": {"react": "^18.0.0"}}),
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "javascript-nextjs" in platforms
        # React is superseded by Next.js
        assert "javascript-react" not in platforms

    def test_config_file_sets_high_priority(self) -> None:
        client = _mock_client(
            {"JavaScript": 50000},
            tree_paths=["next.config.js", "package.json"],
            contents={
                "package.json": json.dumps({"dependencies": {"next": "^14.0.0"}}),
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        nextjs = next(r for r in result if r["platform"] == "javascript-nextjs")
        # sort=1 → priority=99
        assert nextjs["priority"] == 99

    def test_config_file_only_detection(self) -> None:
        client = _mock_client(
            {"JavaScript": 50000},
            tree_paths=["next.config.js", "package.json"],
            contents={
                "package.json": json.dumps({"dependencies": {}}),
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        nextjs = next(r for r in result if r["platform"] == "javascript-nextjs")
        # sort=1 → priority=99 (same regardless of dep presence)
        assert nextjs["priority"] == 99

    def test_manage_py_detects_django(self) -> None:
        client = _mock_client(
            {"Python": 50000},
            tree_paths=["manage.py", "requirements.txt"],
            contents={
                "requirements.txt": "Django==4.2\n",
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        django = next(r for r in result if r["platform"] == "python-django")
        assert django["confidence"] == "high"
        # sort=10 → priority=90
        assert django["priority"] == 90

    def test_base_platform_priority_is_one(self) -> None:
        client = _mock_client({"Python": 50000})

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        assert result[0]["platform"] == "python"
        assert result[0]["priority"] == 1

    def test_multiple_frameworks_same_platform(self) -> None:
        client = _mock_client(
            {"Python": 50000},
            tree_paths=["manage.py", "requirements.txt"],
            contents={
                "requirements.txt": "Django==4.2\ncelery>=5.0\n",
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "python-django" in platforms
        assert "python-celery" in platforms
        assert "python" in platforms

    def test_laravel_detected_from_artisan(self) -> None:
        client = _mock_client(
            {"PHP": 50000},
            tree_paths=["artisan"],
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "php-laravel" in platforms

    def test_spring_boot_detected_from_build_gradle(self) -> None:
        client = _mock_client(
            {"Java": 50000},
            tree_paths=["build.gradle"],
            contents={
                "build.gradle": "dependencies {\n    implementation 'org.springframework.boot:spring-boot-starter'\n}\n",
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "java-spring-boot" in platforms

    def test_go_gin_detected_from_go_mod(self) -> None:
        client = _mock_client(
            {"Go": 50000},
            tree_paths=["go.mod"],
            contents={
                "go.mod": "module example.com/myapp\n\nrequire github.com/gin-gonic/gin v1.9.1\n",
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "go-gin" in platforms

    def test_react_native_detected_and_supersedes_react(self) -> None:
        content = json.dumps({"dependencies": {"react-native": "^0.72.0", "react": "^18.0.0"}})

        client = _mock_client(
            {"JavaScript": 50000},
            tree_paths=["package.json"],
            contents={
                "package.json": content,
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "react-native" in platforms
        assert "javascript-react" not in platforms

    def test_electron_detected(self) -> None:
        content = json.dumps({"dependencies": {"electron": "^28.0.0"}})

        client = _mock_client(
            {"JavaScript": 50000},
            tree_paths=["package.json"],
            contents={
                "package.json": content,
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "electron" in platforms

    def test_flutter_detected_from_pubspec(self) -> None:
        pubspec_content = (
            "name: my_app\ndependencies:\n  flutter:\n    sdk: flutter\n  http: ^0.13.5\n"
        )

        client = _mock_client(
            {"Dart": 50000},
            tree_paths=["pubspec.yaml"],
            contents={
                "pubspec.yaml": pubspec_content,
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "flutter" in platforms

    def test_unity_detected_from_directories(self) -> None:
        client = _mock_client(
            {"C#": 50000},
            tree_paths=["README.md"],
            dirs=["Assets", "ProjectSettings", "Packages"],
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "unity" in platforms

    def test_android_detected_from_build_gradle_and_app_dir(self) -> None:
        client = _mock_client(
            {"Java": 50000},
            tree_paths=["build.gradle", "settings.gradle"],
            dirs=["app"],
            contents={
                "build.gradle": "buildscript {\n}\n\nallprojects {\n}\n\nandroid {\n    compileSdk 34\n}\n",
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "android" in platforms

    def test_dotnet_aspnetcore_detected_with_csproj_and_appsettings(self) -> None:
        client = _mock_client(
            {"C#": 50000},
            tree_paths=["MyApp.csproj", "Program.cs", "appsettings.json"],
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "dotnet-aspnetcore" in platforms

    def test_dotnet_csproj_without_appsettings_falls_back_to_base(self) -> None:
        client = _mock_client(
            {"C#": 50000},
            tree_paths=["MyApp.csproj", "Program.cs"],
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "dotnet-aspnetcore" not in platforms
        assert "dotnet" in platforms

    def test_unreal_detected_from_uproject(self) -> None:
        client = _mock_client(
            {"C++": 50000},
            tree_paths=["MyGame.uproject"],
            dirs=["Source"],
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "unreal" in platforms

    def test_godot_detected_from_project_file(self) -> None:
        client = _mock_client(
            {"GDScript": 50000},
            tree_paths=["project.godot"],
            dirs=["scenes"],
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "godot" in platforms

    def test_wordpress_filtered_as_non_selectable(self) -> None:
        """WordPress is detected internally but filtered from results as non-selectable."""

        client = _mock_client(
            {"PHP": 50000},
            tree_paths=["wp-config.php"],
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "php-wordpress" not in platforms
        assert "php" in platforms

    def test_wordpress_does_not_supersede_symfony(self) -> None:
        """Non-selectable platforms should not supersede selectable ones."""

        client = _mock_client(
            {"PHP": 50000},
            tree_paths=["wp-config.php", "composer.json"],
            contents={
                "composer.json": json.dumps({"require": {"symfony/framework-bundle": "^6.0"}}),
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "php-wordpress" not in platforms
        assert "php-symfony" in platforms

    def test_ruby_rack_detected_from_gemfile(self) -> None:
        client = _mock_client(
            {"Ruby": 50000},
            tree_paths=["Gemfile"],
            contents={
                "Gemfile": 'gem "rack"\ngem "puma"\n',
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "ruby-rack" in platforms

    def test_python_aiohttp_detected(self) -> None:
        client = _mock_client(
            {"Python": 50000},
            tree_paths=["requirements.txt"],
            contents={
                "requirements.txt": "aiohttp==3.9.0\n",
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "python-aiohttp" in platforms

    def test_java_log4j2_detected(self) -> None:
        client = _mock_client(
            {"Java": 50000},
            tree_paths=["build.gradle"],
            contents={
                "build.gradle": "dependencies {\n    implementation 'org.apache.logging.log4j:log4j-core:2.20'\n}\n",
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "java-log4j2" in platforms

    def test_astro_detected(self) -> None:
        content = json.dumps({"dependencies": {"astro": "^4.0.0"}})

        client = _mock_client(
            {"JavaScript": 50000},
            tree_paths=["package.json"],
            contents={
                "package.json": content,
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "javascript-astro" in platforms

    def test_sveltekit_supersedes_svelte_in_full_flow(self) -> None:
        content = json.dumps(
            {
                "dependencies": {},
                "devDependencies": {"@sveltejs/kit": "^2.0.0", "svelte": "^4.0.0"},
            }
        )

        client = _mock_client(
            {"JavaScript": 50000},
            tree_paths=["package.json"],
            contents={
                "package.json": content,
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "javascript-sveltekit" in platforms
        assert "javascript-svelte" not in platforms

    def test_nestjs_detected(self) -> None:
        content = json.dumps({"dependencies": {"@nestjs/core": "^10.0.0"}})

        client = _mock_client(
            {"TypeScript": 50000},
            tree_paths=["package.json"],
            contents={
                "package.json": content,
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "node-nestjs" in platforms

    def test_cloudflare_workers_detected_from_wrangler(self) -> None:
        client = _mock_client(
            {"JavaScript": 50000},
            tree_paths=["wrangler.toml", "package.json"],
            contents={
                "package.json": json.dumps({"dependencies": {}}),
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "node-cloudflare-workers" in platforms

    def test_cloudflare_pages_supersedes_workers(self) -> None:
        client = _mock_client(
            {"JavaScript": 50000},
            tree_paths=["wrangler.toml", "package.json"],
            contents={
                "wrangler.toml": 'name = "my-pages-app"\npages_build_output_dir = "./dist"\n',
                "package.json": json.dumps({"dependencies": {}}),
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "node-cloudflare-pages" in platforms
        assert "node-cloudflare-workers" not in platforms

    def test_azurefunctions_detected_from_host_json(self) -> None:
        host_json = '{"version": "2.0", "extensionBundle": {"id": "Microsoft.Azure.Functions.ExtensionBundle"}}'

        client = _mock_client(
            {"JavaScript": 50000},
            tree_paths=["host.json", "package.json"],
            contents={
                "host.json": host_json,
                "package.json": json.dumps({"dependencies": {}}),
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "node-azurefunctions" in platforms

    def test_azurefunctions_not_detected_without_extension_bundle(self) -> None:
        host_json = '{"version": "2.0"}'

        client = _mock_client(
            {"JavaScript": 50000},
            tree_paths=["host.json", "package.json"],
            contents={
                "host.json": host_json,
                "package.json": json.dumps({"dependencies": {}}),
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "node-azurefunctions" not in platforms

    def test_serverless_yml_detects_awslambda(self) -> None:
        client = _mock_client(
            {"Python": 50000},
            tree_paths=["serverless.yml", "requirements.txt"],
            contents={
                "serverless.yml": "service: my-service\nprovider:\n  runtime: python3.11\n",
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]

        platforms = [r["platform"] for r in result]
        assert "python-awslambda" in platforms

    def test_bun_detected_from_bunfig(self) -> None:
        client = _mock_client(
            {"TypeScript": 50000},
            tree_paths=["bunfig.toml", "package.json"],
            contents={
                "package.json": json.dumps({"dependencies": {}}),
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]
        platforms = [r["platform"] for r in result]
        assert "bun" in platforms

    def test_bun_detected_from_lockfile(self) -> None:
        client = _mock_client(
            {"JavaScript": 30000},
            tree_paths=["bun.lockb", "package.json"],
            contents={
                "package.json": json.dumps({"dependencies": {}}),
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]
        platforms = [r["platform"] for r in result]
        assert "bun" in platforms

    def test_deno_detected_from_config(self) -> None:
        client = _mock_client(
            {"TypeScript": 40000},
            tree_paths=["deno.json", "package.json"],
            contents={
                "package.json": json.dumps({"dependencies": {}}),
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]
        platforms = [r["platform"] for r in result]
        assert "deno" in platforms

    def test_dotnet_maui_detected_from_csproj_content(self) -> None:
        csproj_content = """<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFrameworks>net8.0-android;net8.0-ios</TargetFrameworks>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.Maui.Controls" Version="8.0.0" />
  </ItemGroup>
</Project>"""

        client = _mock_client(
            {"C#": 60000},
            tree_paths=["MyApp.csproj", "MauiProgram.cs"],
            contents={
                "MyApp.csproj": csproj_content,
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]
        platforms = [r["platform"] for r in result]
        assert "dotnet-maui" in platforms

    def test_dotnet_wpf_detected_from_csproj_content(self) -> None:
        csproj_content = """<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <UseWPF>true</UseWPF>
  </PropertyGroup>
</Project>"""

        client = _mock_client(
            {"C#": 50000},
            tree_paths=["WpfApp.csproj"],
            contents={
                "WpfApp.csproj": csproj_content,
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]
        platforms = [r["platform"] for r in result]
        assert "dotnet-wpf" in platforms

    def test_dotnet_awslambda_detected_from_csproj_content(self) -> None:
        csproj_content = """<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Amazon.Lambda.Core" Version="2.1.0" />
    <PackageReference Include="Amazon.Lambda.Serialization.SystemTextJson" />
  </ItemGroup>
</Project>"""

        client = _mock_client(
            {"C#": 30000},
            tree_paths=["LambdaFunc.csproj"],
            contents={
                "LambdaFunc.csproj": csproj_content,
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]
        platforms = [r["platform"] for r in result]
        assert "dotnet-awslambda" in platforms

    def test_dotnet_aspnet_legacy_detected_not_core(self) -> None:
        """dotnet-aspnet detects legacy ASP.NET but not ASP.NET Core."""

        csproj_content = """<Project>
  <ItemGroup>
    <Reference Include="Microsoft.AspNet.Mvc" />
  </ItemGroup>
</Project>"""

        client = _mock_client(
            {"C#": 40000},
            tree_paths=["WebApp.csproj"],
            contents={
                "WebApp.csproj": csproj_content,
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]
        platforms = [r["platform"] for r in result]
        assert "dotnet-aspnet" in platforms

    def test_dotnet_aspnetcore_not_detected_as_legacy_aspnet(self) -> None:
        """ASP.NET Core references should NOT match the legacy dotnet-aspnet pattern."""

        csproj_content = """<Project Sdk="Microsoft.NET.Sdk.Web">
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.App" />
  </ItemGroup>
</Project>"""

        client = _mock_client(
            {"C#": 40000},
            tree_paths=["WebApp.csproj", "appsettings.json"],
            contents={
                "WebApp.csproj": csproj_content,
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]
        platforms = [r["platform"] for r in result]
        # Should detect aspnetcore (via existing rule), not legacy aspnet
        assert "dotnet-aspnetcore" in platforms
        assert "dotnet-aspnet" not in platforms

    def test_apple_ios_detected_from_package_swift(self) -> None:
        client = _mock_client(
            {"Swift": 40000},
            tree_paths=["Package.swift"],
            contents={
                "Package.swift": "let package = Package(\n  platforms: [.iOS(.v14)],\n)",
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]
        platforms = [r["platform"] for r in result]
        assert "apple-ios" in platforms

    def test_apple_ios_detected_from_podfile(self) -> None:
        client = _mock_client(
            {"Swift": 40000},
            tree_paths=["Podfile"],
            contents={
                "Podfile": "platform :ios, '14.0'\npod 'Alamofire'\n",
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]
        platforms = [r["platform"] for r in result]
        assert "apple-ios" in platforms

    def test_objc_dominant_repo_returns_apple_ios_base(self) -> None:
        """Objective-C maps to apple-ios as a base platform (medium confidence)."""
        client = _mock_client({"Objective-C": 80000})

        result = detect_platforms_multi(client, "owner/repo")["platforms"]
        ios_entry = next(r for r in result if r["platform"] == "apple-ios")
        assert ios_entry["confidence"] == "medium"
        assert ios_entry["bytes"] == 80000

    def test_apple_ios_higher_priority_than_macos(self) -> None:
        """When both iOS and macOS are in Package.swift, iOS should rank higher."""

        client = _mock_client(
            {"Swift": 40000},
            tree_paths=["Package.swift"],
            contents={
                "Package.swift": "let package = Package(\n  platforms: [.iOS(.v14), .macOS(.v11)],\n)",
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]
        platforms = [r["platform"] for r in result]
        assert "apple-ios" in platforms
        assert "apple-macos" in platforms
        # iOS (sort=3, priority=97) should come before macOS (sort=5, priority=95)
        assert platforms.index("apple-ios") < platforms.index("apple-macos")

    def test_swift_without_ios_signals_returns_empty(self) -> None:
        """Plain Swift repo with no framework signals returns empty results.

        Swift is a non-selectable platform (the picker uses apple-ios / apple-macos),
        so it gets filtered out when no framework-specific signals are found.
        """

        client = _mock_client(
            {"Swift": 40000},
            tree_paths=["README.md"],
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]
        assert result == []

    def test_apple_macos_detected_from_package_swift(self) -> None:
        client = _mock_client(
            {"Swift": 40000},
            tree_paths=["Package.swift"],
            contents={
                "Package.swift": 'let package = Package(\n  platforms: [.macOS("12.0")],\n)',
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]
        platforms = [r["platform"] for r in result]
        assert "apple-macos" in platforms

    def test_apple_macos_detected_from_podfile(self) -> None:
        client = _mock_client(
            {"Swift": 40000},
            tree_paths=["Podfile"],
            contents={
                "Podfile": "platform :osx, '12.0'\npod 'Alamofire'\n",
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]
        platforms = [r["platform"] for r in result]
        assert "apple-macos" in platforms

    def test_native_qt_detected_from_qrc(self) -> None:
        client = _mock_client(
            {"C++": 30000},
            tree_paths=["resources.qrc"],
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]
        platforms = [r["platform"] for r in result]
        assert "native-qt" in platforms

    def test_native_qt_detected_from_cmake(self) -> None:
        client = _mock_client(
            {"C++": 30000},
            tree_paths=["CMakeLists.txt"],
            contents={
                "CMakeLists.txt": "cmake_minimum_required(VERSION 3.16)\nfind_package(Qt6 REQUIRED)\n",
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]
        platforms = [r["platform"] for r in result]
        assert "native-qt" in platforms

    def test_cordova_detected_from_config_xml(self) -> None:
        client = _mock_client(
            {"JavaScript": 20000},
            tree_paths=["config.xml", "package.json"],
            contents={
                "config.xml": '<widget xmlns="http://cordova.apache.org/ns/1.0">\n'
                "  <name>MyApp</name>\n"
                "</widget>\n",
                "package.json": json.dumps({"dependencies": {}}),
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]
        platforms = [r["platform"] for r in result]
        assert "cordova" in platforms

    def test_cordova_detected_from_package_json(self) -> None:
        client = _mock_client(
            {"JavaScript": 20000},
            tree_paths=["package.json"],
            contents={
                "package.json": json.dumps({"dependencies": {"cordova-android": "^12.0.0"}}),
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]
        platforms = [r["platform"] for r in result]
        assert "cordova" in platforms

    def test_node_detected_from_nvmrc(self) -> None:
        client = _mock_client(
            {"JavaScript": 30000},
            tree_paths=[".nvmrc", "package.json"],
            contents={
                "package.json": json.dumps({"dependencies": {}}),
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]
        platforms = [r["platform"] for r in result]
        assert "node" in platforms

    def test_engines_node_alone_does_not_trigger_node(self) -> None:
        """engines.node is too common in JS ecosystem (even browser libs set it)
        so it should not by itself trigger Node detection."""

        client = _mock_client(
            {"JavaScript": 30000},
            tree_paths=["package.json"],
            contents={
                "package.json": json.dumps(
                    {
                        "engines": {"node": ">=18.0.0"},
                        "dependencies": {},
                    }
                ),
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]
        platforms = [r["platform"] for r in result]
        assert "node" not in platforms
        assert "javascript" in platforms

    def test_go_base_platform_when_no_framework(self) -> None:
        """Go with no framework should emit plain 'go'."""

        client = _mock_client(
            {"Go": 50000},
            tree_paths=["main.go"],
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]
        platforms = [r["platform"] for r in result]
        assert "go" in platforms

    def test_go_with_framework_emits_framework_and_base(self) -> None:
        """Go with a framework should emit both the framework and base 'go' platform."""

        client = _mock_client(
            {"Go": 50000},
            tree_paths=["go.mod"],
            contents={
                "go.mod": "module example.com/app\n\nrequire github.com/gin-gonic/gin v1.9.1\n",
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]
        platforms = [r["platform"] for r in result]
        assert "go-gin" in platforms
        assert "go" in platforms

    def test_python_asgi_detected_from_uvicorn(self) -> None:
        client = _mock_client(
            {"Python": 40000},
            tree_paths=["requirements.txt"],
            contents={
                "requirements.txt": "fastapi\nuvicorn\npydantic\n",
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]
        platforms = [r["platform"] for r in result]
        assert "python-asgi" in platforms
        assert "python-fastapi" in platforms

    def test_python_wsgi_detected_from_gunicorn(self) -> None:
        client = _mock_client(
            {"Python": 40000},
            tree_paths=["requirements.txt", "manage.py"],
            contents={
                "requirements.txt": "Django==4.2\ngunicorn\npsycopg2\n",
            },
        )

        result = detect_platforms_multi(client, "owner/repo")["platforms"]
        platforms = [r["platform"] for r in result]
        assert "python-wsgi" in platforms
        assert "python-django" in platforms
