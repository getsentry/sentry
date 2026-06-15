from __future__ import annotations

from sentry.integrations.github.multi_platform_detection import (
    _build_tree_index,
    _framework_matches_scoped,
    _rule_existence_fires_in_scope,
    _rule_parent_dirs,
)
from sentry.integrations.github.platform_registry import (
    DetectorRule,
    FrameworkDef,
)


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
        # Fast basename set also populated
        assert "Assets" in index.dirs

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

    def test_files_property_returns_basenames(self) -> None:
        entries = [
            {"path": "fe/next.config.js", "type": "blob", "size": 100},
            {"path": "be/manage.py", "type": "blob", "size": 200},
        ]
        index = _build_tree_index(entries)
        assert index.files == {"next.config.js", "manage.py"}

    def test_root_level_entries_indexed(self) -> None:
        entries = [
            {"path": "manage.py", "type": "blob", "size": 50},
            {"path": "Assets", "type": "tree"},
        ]
        index = _build_tree_index(entries)
        assert index.files_full_paths_by_basename["manage.py"] == {"manage.py"}
        assert index.dirs_full_paths_by_basename["Assets"] == {"Assets"}


class TestRuleParentDirs:
    def test_path_rule_returns_parent_dir(self) -> None:
        files = {"next.config.js": {"fe/next.config.js"}}
        result = _rule_parent_dirs({"path": "next.config.js"}, files, {})
        assert result == {"fe"}

    def test_path_rule_at_root_returns_empty_string_scope(self) -> None:
        files = {"manage.py": {"manage.py"}}
        result = _rule_parent_dirs({"path": "manage.py"}, files, {})
        assert result == {""}

    def test_path_rule_multiple_occurrences_collects_all_parents(self) -> None:
        files = {"package.json": {"fe/package.json", "be/package.json"}}
        result = _rule_parent_dirs({"path": "package.json"}, files, {})
        assert result == {"fe", "be"}

    def test_path_rule_absent_returns_empty_set(self) -> None:
        result = _rule_parent_dirs({"path": "manage.py"}, {}, {})
        assert result == set()

    def test_match_ext_returns_union_of_parent_dirs(self) -> None:
        files = {
            "myapp.csproj": {"apps/web/myapp.csproj"},
            "lib.csproj": {"apps/lib/lib.csproj"},
        }
        result = _rule_parent_dirs({"match_ext": ".csproj"}, files, {})
        assert result == {"apps/web", "apps/lib"}

    def test_match_dir_returns_parent_dirs(self) -> None:
        dirs = {"Assets": {"Assets", "myproject/Assets"}}
        result = _rule_parent_dirs({"match_dir": "Assets"}, {}, dirs)
        assert result == {"", "myproject"}

    def test_match_dir_dotted_name_uses_endswith(self) -> None:
        # .xcodeproj dirs are matched by endswith, not equality
        dirs = {"MyApp.xcodeproj": {"MyApp.xcodeproj"}}
        result = _rule_parent_dirs({"match_dir": ".xcodeproj"}, {}, dirs)
        assert result == {""}

    def test_match_content_returns_none(self) -> None:
        # match_content rules are deferred to Tier 2 — existence pass cannot evaluate them
        files = {"requirements.txt": {"requirements.txt"}}
        rule: DetectorRule = {"path": "requirements.txt", "match_content": r"django"}
        assert _rule_parent_dirs(rule, files, {}) is None

    def test_match_package_returns_none(self) -> None:
        # match_package rules need a parsed manifest — deferred to Tier 2
        assert _rule_parent_dirs({"match_package": "next"}, {}, {}) is None


class TestRuleExistenceFiresInScope:
    def test_path_rule_matching_scope(self) -> None:
        files = {"appsettings.json": {"backend/appsettings.json"}}
        assert (
            _rule_existence_fires_in_scope({"path": "appsettings.json"}, "backend", files, {})
            is True
        )

    def test_path_rule_wrong_scope(self) -> None:
        files = {"appsettings.json": {"backend/appsettings.json"}}
        assert (
            _rule_existence_fires_in_scope({"path": "appsettings.json"}, "frontend", files, {})
            is False
        )

    def test_path_rule_root_scope(self) -> None:
        files = {"manage.py": {"manage.py"}}
        assert _rule_existence_fires_in_scope({"path": "manage.py"}, "", files, {}) is True

    def test_match_ext_in_scope(self) -> None:
        files = {"myapp.csproj": {"apps/web/myapp.csproj"}}
        assert (
            _rule_existence_fires_in_scope({"match_ext": ".csproj"}, "apps/web", files, {}) is True
        )

    def test_match_ext_outside_scope(self) -> None:
        files = {"myapp.csproj": {"apps/web/myapp.csproj"}}
        # "apps" is the grandparent, not the immediate parent
        assert _rule_existence_fires_in_scope({"match_ext": ".csproj"}, "apps", files, {}) is False

    def test_match_dir_in_scope(self) -> None:
        dirs = {"Assets": {"myproject/Assets"}}
        assert (
            _rule_existence_fires_in_scope({"match_dir": "Assets"}, "myproject", {}, dirs) is True
        )

    def test_match_dir_outside_scope(self) -> None:
        dirs = {"Assets": {"myproject/Assets"}}
        assert _rule_existence_fires_in_scope({"match_dir": "Assets"}, "", {}, dirs) is False

    def test_match_content_always_false(self) -> None:
        files = {"requirements.txt": {"requirements.txt"}}
        rule: DetectorRule = {"path": "requirements.txt", "match_content": r"django"}
        assert _rule_existence_fires_in_scope(rule, "", files, {}) is False

    def test_match_package_always_false(self) -> None:
        assert _rule_existence_fires_in_scope({"match_package": "next"}, "", {}, {}) is False


class TestFrameworkMatchesScoped:
    def test_some_only_path_matches(self) -> None:
        fw: FrameworkDef = {
            "platform": "godot",
            "sort": 10,
            "base_platform": "godot",
            "some": [{"path": "project.godot"}],
        }
        assert _framework_matches_scoped(fw, {"project.godot": {"project.godot"}}, {}) is True

    def test_some_only_path_absent(self) -> None:
        fw: FrameworkDef = {
            "platform": "godot",
            "sort": 10,
            "base_platform": "godot",
            "some": [{"path": "project.godot"}],
        }
        assert _framework_matches_scoped(fw, {}, {}) is False

    def test_some_only_match_package_false_without_manifest(self) -> None:
        # match_package rules need a parsed manifest — always False in existence pass
        fw: FrameworkDef = {
            "platform": "javascript-nextjs",
            "sort": 1,
            "base_platform": "javascript",
            "some": [{"match_package": "next"}],
            "supersedes": ["javascript-react"],
        }
        assert _framework_matches_scoped(fw, {"package.json": {"package.json"}}, {}) is False

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
        assert _framework_matches_scoped(fw, files, {}) is True

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
        assert _framework_matches_scoped(fw, files, {}) is False

    def test_every_match_dir_same_scope(self) -> None:
        # unity: Assets/ + ProjectSettings/ at the same level → match
        fw: FrameworkDef = {
            "platform": "unity",
            "sort": 10,
            "base_platform": "dotnet",
            "every": [{"match_dir": "Assets"}, {"match_dir": "ProjectSettings"}],
        }
        dirs = {"Assets": {"Assets"}, "ProjectSettings": {"ProjectSettings"}}
        assert _framework_matches_scoped(fw, {}, dirs) is True

    def test_every_match_dir_different_scopes_no_match(self) -> None:
        # Assets at root, ProjectSettings inside backend/ — not a Unity project
        fw: FrameworkDef = {
            "platform": "unity",
            "sort": 10,
            "base_platform": "dotnet",
            "every": [{"match_dir": "Assets"}, {"match_dir": "ProjectSettings"}],
        }
        dirs = {"Assets": {"Assets"}, "ProjectSettings": {"backend/ProjectSettings"}}
        assert _framework_matches_scoped(fw, {}, dirs) is False

    def test_every_with_match_content_deferred_returns_false(self) -> None:
        # dotnet-maui requires content inside the .csproj — deferred to Tier 2
        fw: FrameworkDef = {
            "platform": "dotnet-maui",
            "sort": 10,
            "base_platform": "dotnet",
            "every": [{"match_ext": ".csproj", "match_content": r"Microsoft\.Maui"}],
        }
        assert _framework_matches_scoped(fw, {"myapp.csproj": {"myapp.csproj"}}, {}) is False

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
        assert _framework_matches_scoped(fw, files, dirs) is True

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
        assert _framework_matches_scoped(fw, files, dirs) is False

    def test_empty_every_and_some_returns_false(self) -> None:
        fw: FrameworkDef = {"platform": "empty", "sort": 10, "base_platform": "python"}
        assert _framework_matches_scoped(fw, {}, {}) is False
