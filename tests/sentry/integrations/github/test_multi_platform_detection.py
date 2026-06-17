from __future__ import annotations

from base64 import b64encode
from typing import Any
from unittest import mock

from sentry.integrations.github.multi_platform_detection import (
    _build_tree_index,
    _collect_needed_paths,
    _framework_matches_scoped,
    _rule_parent_dirs,
    detect_platforms_multi,
)
from sentry.integrations.github.platform_registry import (
    DetectorRule,
    FrameworkDef,
    _PackageManifest,
)
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils import json


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

    def test_match_content_honors_inline_ignorecase_flag(self) -> None:
        # Patterns that want case-insensitivity embed (?i) themselves.
        rule: DetectorRule = {"path": "requirements.txt", "match_content": r"(?i)\bdjango\b"}
        content = {"requirements.txt": "DJANGO==4.2\n"}
        assert _rule_parent_dirs(rule, {}, {}, content, {}) == {""}

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
        # Root package.json (deps: next) + 6 deeper workspace package.json files.
        # Cap is 5; root must be read so javascript-nextjs is detected.
        # The alphabetically-last deep manifest (packages/f/package.json) must not be fetched.
        deep_names = [f"packages/{c}/package.json" for c in "abcdef"]  # 6 paths
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
        assert "package.json" in fetched
        assert "packages/f/package.json" not in fetched

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
