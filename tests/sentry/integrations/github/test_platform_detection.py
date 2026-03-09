from __future__ import annotations

from base64 import b64encode
from unittest import mock

import pytest

from sentry.integrations.github.platform_detection import (
    FRAMEWORKS,
    GITHUB_LANGUAGE_TO_SENTRY_PLATFORM,
    DetectedPlatform,
    DetectorRule,
    FrameworkDef,
    _apply_supersession,
    _framework_matches,
    _get_repo_file_content,
    _get_root_entries,
    _package_in_manifest,
    _PackageManifest,
    _parse_gemfile,
    _parse_go_mod,
    _parse_package_manifest,
    _parse_pubspec_yaml,
    _rule_matches,
    detect_platforms,
)
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils import json


class TestGithubLanguageMapping:
    def test_python_maps_to_python(self) -> None:
        assert GITHUB_LANGUAGE_TO_SENTRY_PLATFORM["Python"] == "python"

    def test_typescript_maps_to_javascript(self) -> None:
        assert GITHUB_LANGUAGE_TO_SENTRY_PLATFORM["TypeScript"] == "javascript"

    def test_javascript_maps_to_javascript(self) -> None:
        assert GITHUB_LANGUAGE_TO_SENTRY_PLATFORM["JavaScript"] == "javascript"

    def test_csharp_maps_to_dotnet(self) -> None:
        assert GITHUB_LANGUAGE_TO_SENTRY_PLATFORM["C#"] == "dotnet"

    def test_objectivec_maps_to_apple_ios(self) -> None:
        assert GITHUB_LANGUAGE_TO_SENTRY_PLATFORM["Objective-C"] == "apple-ios"

    def test_powershell_maps_to_powershell(self) -> None:
        assert GITHUB_LANGUAGE_TO_SENTRY_PLATFORM["PowerShell"] == "powershell"

    def test_unmapped_language_returns_none(self) -> None:
        assert GITHUB_LANGUAGE_TO_SENTRY_PLATFORM.get("Haskell") is None


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

    def test_delegates_to_go_mod(self) -> None:
        content = "module example.com/app\n\nrequire github.com/gin-gonic/gin v1.9.1\n"
        result = _parse_package_manifest(content, "go.mod")
        assert result is not None
        assert "github.com/gin-gonic/gin" in result["dependencies"]


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


class TestParseGoMod:
    def test_single_require(self) -> None:
        content = "module example.com/app\n\nrequire github.com/gin-gonic/gin v1.9.1\n"
        result = _parse_go_mod(content)
        assert "github.com/gin-gonic/gin" in result["dependencies"]

    def test_require_block(self) -> None:
        content = (
            "module example.com/app\n\n"
            "require (\n"
            "\tgithub.com/gin-gonic/gin v1.9.1\n"
            "\tgithub.com/labstack/echo/v4 v4.11.0\n"
            ")\n"
        )
        result = _parse_go_mod(content)
        assert "github.com/gin-gonic/gin" in result["dependencies"]
        assert "github.com/labstack/echo/v4" in result["dependencies"]

    def test_empty_go_mod(self) -> None:
        result = _parse_go_mod("module example.com/app\n\ngo 1.21\n")
        assert result["dependencies"] == set()

    def test_skips_commented_lines_in_require_block(self) -> None:
        content = (
            "module example.com/app\n\n"
            "require (\n"
            "\tgithub.com/gin-gonic/gin v1.9.1\n"
            "\t// github.com/old/dep v0.1.0\n"
            "\tgithub.com/labstack/echo/v4 v4.11.0\n"
            ")\n"
        )
        result = _parse_go_mod(content)
        assert "github.com/gin-gonic/gin" in result["dependencies"]
        assert "github.com/labstack/echo/v4" in result["dependencies"]
        assert "//" not in result["dependencies"]
        assert "github.com/old/dep" not in result["dependencies"]

    def test_skips_commented_single_require(self) -> None:
        content = "module example.com/app\n\n// require github.com/old/dep v0.1.0\n"
        result = _parse_go_mod(content)
        assert result["dependencies"] == set()


class TestPackageInManifest:
    def test_exact_match_in_dependencies(self) -> None:
        manifest = _PackageManifest(dependencies={"next", "react"}, dev_dependencies=set())
        assert _package_in_manifest("next", manifest) is True

    def test_exact_match_in_dev_dependencies(self) -> None:
        manifest = _PackageManifest(dependencies=set(), dev_dependencies={"jest"})
        assert _package_in_manifest("jest", manifest) is True

    def test_no_match(self) -> None:
        manifest = _PackageManifest(dependencies={"react"}, dev_dependencies=set())
        assert _package_in_manifest("vue", manifest) is False

    def test_prefix_match_for_composer(self) -> None:
        manifest = _PackageManifest(
            dependencies={"symfony/framework-bundle"}, dev_dependencies=set()
        )
        assert _package_in_manifest("symfony/", manifest) is True

    def test_prefix_no_match(self) -> None:
        manifest = _PackageManifest(dependencies={"laravel/framework"}, dev_dependencies=set())
        assert _package_in_manifest("symfony/", manifest) is False

    def test_go_module_version_path_match(self) -> None:
        manifest = _PackageManifest(
            dependencies={"github.com/labstack/echo/v4"}, dev_dependencies=set()
        )
        assert _package_in_manifest("github.com/labstack/echo", manifest) is True

    def test_go_module_exact_match(self) -> None:
        manifest = _PackageManifest(
            dependencies={"github.com/gin-gonic/gin"}, dev_dependencies=set()
        )
        assert _package_in_manifest("github.com/gin-gonic/gin", manifest) is True

    def test_go_module_version_no_false_positive_on_similar_path(self) -> None:
        manifest = _PackageManifest(
            dependencies={"github.com/foo/bar/validator"}, dev_dependencies=set()
        )
        assert _package_in_manifest("github.com/foo/bar", manifest) is False

    def test_npm_scoped_package_no_go_version_matching(self) -> None:
        manifest = _PackageManifest(dependencies={"@nestjs/core"}, dev_dependencies=set())
        assert _package_in_manifest("@nestjs/core", manifest) is True
        assert _package_in_manifest("@nestjs/missing", manifest) is False


class TestRuleMatches:
    def test_path_rule_matches_when_file_exists(self) -> None:
        rule: DetectorRule = {"path": "next.config.js"}
        assert _rule_matches(rule, {"next.config.js", "package.json"}, {}, None) is True

    def test_path_rule_no_match_when_file_missing(self) -> None:
        rule: DetectorRule = {"path": "next.config.js"}
        assert _rule_matches(rule, {"package.json"}, {}, None) is False

    def test_path_with_content_matches_regex(self) -> None:
        rule: DetectorRule = {"path": "requirements.txt", "match_content": r"(?i)\bdjango\b"}
        assert (
            _rule_matches(rule, set(), {"requirements.txt": "Django==4.2\ncelery>=5.0\n"}, None)
            is True
        )

    def test_path_with_content_case_insensitive(self) -> None:
        rule: DetectorRule = {"path": "requirements.txt", "match_content": r"(?i)\bflask\b"}
        assert _rule_matches(rule, set(), {"requirements.txt": "Flask==3.0\n"}, None) is True

    def test_path_with_content_no_match(self) -> None:
        rule: DetectorRule = {"path": "requirements.txt", "match_content": r"(?i)\bdjango\b"}
        assert _rule_matches(rule, set(), {"requirements.txt": "flask==3.0\n"}, None) is False

    def test_path_with_content_file_not_fetched(self) -> None:
        rule: DetectorRule = {"path": "requirements.txt", "match_content": r"(?i)\bdjango\b"}
        assert _rule_matches(rule, set(), {}, None) is False

    def test_match_package_finds_dependency(self) -> None:
        rule: DetectorRule = {"match_package": "next"}
        manifest = _PackageManifest(dependencies={"next", "react"}, dev_dependencies=set())
        assert _rule_matches(rule, set(), {}, manifest) is True

    def test_match_package_finds_dev_dependency(self) -> None:
        rule: DetectorRule = {"match_package": "svelte"}
        manifest = _PackageManifest(dependencies=set(), dev_dependencies={"svelte"})
        assert _rule_matches(rule, set(), {}, manifest) is True

    def test_match_package_no_match(self) -> None:
        rule: DetectorRule = {"match_package": "next"}
        manifest = _PackageManifest(dependencies={"react"}, dev_dependencies=set())
        assert _rule_matches(rule, set(), {}, manifest) is False

    def test_match_package_no_manifest(self) -> None:
        rule: DetectorRule = {"match_package": "next"}
        assert _rule_matches(rule, set(), {}, None) is False

    def test_match_package_prefix_match(self) -> None:
        rule: DetectorRule = {"match_package": "symfony/"}
        manifest = _PackageManifest(
            dependencies={"symfony/framework-bundle"}, dev_dependencies=set()
        )
        assert _rule_matches(rule, set(), {}, manifest) is True

    def test_rule_without_path_or_package_returns_false(self) -> None:
        rule: DetectorRule = {}
        assert _rule_matches(rule, {"file.txt"}, {}, None) is False

    def test_match_dir_matches_when_dir_exists(self) -> None:
        rule: DetectorRule = {"match_dir": "Assets"}
        assert _rule_matches(rule, set(), {}, None, root_dirs={"Assets", "src"}) is True

    def test_match_dir_no_match_when_dir_missing(self) -> None:
        rule: DetectorRule = {"match_dir": "Assets"}
        assert _rule_matches(rule, set(), {}, None, root_dirs={"src", "lib"}) is False

    def test_match_dir_no_match_when_root_dirs_none(self) -> None:
        rule: DetectorRule = {"match_dir": "Assets"}
        assert _rule_matches(rule, set(), {}, None, root_dirs=None) is False

    def test_match_ext_matches_when_extension_exists(self) -> None:
        rule: DetectorRule = {"match_ext": ".csproj"}
        assert _rule_matches(rule, {"MyApp.csproj", "README.md"}, {}, None) is True

    def test_match_ext_no_match_when_extension_missing(self) -> None:
        rule: DetectorRule = {"match_ext": ".csproj"}
        assert _rule_matches(rule, {"README.md", "package.json"}, {}, None) is False

    def test_match_ext_uproject(self) -> None:
        rule: DetectorRule = {"match_ext": ".uproject"}
        assert _rule_matches(rule, {"MyGame.uproject"}, {}, None) is True

    def test_match_ext_with_match_content_matches(self) -> None:
        rule: DetectorRule = {"match_ext": ".csproj", "match_content": r"Microsoft\.Maui"}
        files = {"MyApp.csproj", "README.md"}
        contents = {"MyApp.csproj": '<PackageReference Include="Microsoft.Maui" />'}
        assert _rule_matches(rule, files, contents, None) is True

    def test_match_ext_with_match_content_no_content_match(self) -> None:
        rule: DetectorRule = {"match_ext": ".csproj", "match_content": r"Microsoft\.Maui"}
        files = {"MyApp.csproj", "README.md"}
        contents = {"MyApp.csproj": '<PackageReference Include="Newtonsoft.Json" />'}
        assert _rule_matches(rule, files, contents, None) is False

    def test_match_ext_with_match_content_no_ext_match(self) -> None:
        rule: DetectorRule = {"match_ext": ".csproj", "match_content": r"Microsoft\.Maui"}
        files = {"README.md", "package.json"}
        assert _rule_matches(rule, files, {}, None) is False

    def test_match_ext_with_match_content_no_fetched_content(self) -> None:
        rule: DetectorRule = {"match_ext": ".csproj", "match_content": r"Microsoft\.Maui"}
        files = {"MyApp.csproj"}
        # File exists but content wasn't fetched
        assert _rule_matches(rule, files, {}, None) is False


class TestFrameworkMatches:
    def test_some_rules_match_when_any_passes(self) -> None:
        fw: FrameworkDef = {
            "platform": "test",
            "sort": 1,
            "base_platform": "test",
            "some": [
                {"path": "missing.js"},
                {"path": "found.js"},
            ],
        }
        assert _framework_matches(fw, {"found.js"}, {}, None) is True

    def test_some_rules_no_match_when_none_pass(self) -> None:
        fw: FrameworkDef = {
            "platform": "test",
            "sort": 1,
            "base_platform": "test",
            "some": [
                {"path": "missing1.js"},
                {"path": "missing2.js"},
            ],
        }
        assert _framework_matches(fw, set(), {}, None) is False

    def test_every_rules_match_when_all_pass(self) -> None:
        manifest = _PackageManifest(dependencies={"express", "cors"}, dev_dependencies=set())
        fw: FrameworkDef = {
            "platform": "test",
            "sort": 1,
            "base_platform": "test",
            "every": [{"match_package": "express"}],
        }
        assert _framework_matches(fw, set(), {}, manifest) is True

    def test_every_rules_no_match_when_one_fails(self) -> None:
        manifest = _PackageManifest(dependencies={"cors"}, dev_dependencies=set())
        fw: FrameworkDef = {
            "platform": "test",
            "sort": 1,
            "base_platform": "test",
            "every": [
                {"match_package": "express"},
                {"match_package": "cors"},
            ],
        }
        assert _framework_matches(fw, set(), {}, manifest) is False

    def test_every_and_some_combined(self) -> None:
        manifest = _PackageManifest(dependencies={"express"}, dev_dependencies=set())
        fw: FrameworkDef = {
            "platform": "test",
            "sort": 1,
            "base_platform": "test",
            "every": [{"match_package": "express"}],
            "some": [{"path": "app.js"}, {"path": "server.js"}],
        }
        # every passes, some passes (server.js exists)
        assert _framework_matches(fw, {"server.js"}, {}, manifest) is True
        # every passes, some fails (neither file exists)
        assert _framework_matches(fw, set(), {}, manifest) is False

    def test_empty_every_and_some_returns_false(self) -> None:
        fw: FrameworkDef = {"platform": "test", "sort": 1, "base_platform": "test"}
        assert _framework_matches(fw, set(), {}, None) is False

    def test_match_dir_in_every(self) -> None:
        fw: FrameworkDef = {
            "platform": "test",
            "sort": 1,
            "base_platform": "test",
            "every": [{"match_dir": "Assets"}, {"match_dir": "ProjectSettings"}],
        }
        assert (
            _framework_matches(
                fw, set(), {}, None, root_dirs={"Assets", "ProjectSettings", "Packages"}
            )
            is True
        )
        assert _framework_matches(fw, set(), {}, None, root_dirs={"Assets"}) is False

    def test_match_ext_in_some(self) -> None:
        fw: FrameworkDef = {
            "platform": "test",
            "sort": 1,
            "base_platform": "test",
            "some": [{"match_ext": ".csproj"}],
        }
        assert _framework_matches(fw, {"MyApp.csproj"}, {}, None) is True
        assert _framework_matches(fw, {"README.md"}, {}, None) is False

    def test_nextjs_matches_from_package(self) -> None:
        nextjs = next(fw for fw in FRAMEWORKS if fw["platform"] == "javascript-nextjs")
        manifest = _PackageManifest(dependencies={"next", "react"}, dev_dependencies=set())
        assert _framework_matches(nextjs, set(), {}, manifest) is True

    def test_nextjs_matches_from_config_file(self) -> None:
        nextjs = next(fw for fw in FRAMEWORKS if fw["platform"] == "javascript-nextjs")
        assert _framework_matches(nextjs, {"next.config.js"}, {}, None) is True

    def test_django_matches_from_manage_py(self) -> None:
        django = next(fw for fw in FRAMEWORKS if fw["platform"] == "python-django")
        assert _framework_matches(django, {"manage.py"}, {}, None) is True

    def test_django_matches_from_requirements_content(self) -> None:
        django = next(fw for fw in FRAMEWORKS if fw["platform"] == "python-django")
        assert (
            _framework_matches(
                django, set(), {"requirements.txt": "Django==4.2\ncelery>=5.0\n"}, None
            )
            is True
        )

    def test_unity_matches_from_directories(self) -> None:
        unity = next(fw for fw in FRAMEWORKS if fw["platform"] == "unity")
        assert (
            _framework_matches(
                unity, set(), {}, None, root_dirs={"Assets", "ProjectSettings", "Packages"}
            )
            is True
        )
        assert _framework_matches(unity, set(), {}, None, root_dirs={"Assets"}) is False

    def test_flutter_matches_from_pubspec(self) -> None:
        flutter = next(fw for fw in FRAMEWORKS if fw["platform"] == "flutter")
        manifest = _PackageManifest(dependencies={"flutter", "http"}, dev_dependencies=set())
        assert _framework_matches(flutter, set(), {}, manifest) is True

    def test_dotnet_aspnetcore_matches_with_csproj_and_appsettings(self) -> None:
        aspnet = next(fw for fw in FRAMEWORKS if fw["platform"] == "dotnet-aspnetcore")
        assert _framework_matches(aspnet, {"MyApp.csproj", "appsettings.json"}, {}, None) is True

    def test_dotnet_aspnetcore_no_match_csproj_only(self) -> None:
        aspnet = next(fw for fw in FRAMEWORKS if fw["platform"] == "dotnet-aspnetcore")
        assert _framework_matches(aspnet, {"MyApp.csproj"}, {}, None) is False

    def test_dotnet_aspnetcore_no_match_appsettings_only(self) -> None:
        aspnet = next(fw for fw in FRAMEWORKS if fw["platform"] == "dotnet-aspnetcore")
        assert _framework_matches(aspnet, {"appsettings.json"}, {}, None) is False


class TestGetRootEntries:
    def test_returns_files_and_dirs(self) -> None:
        client = mock.MagicMock()
        client.get.return_value = [
            {"name": "package.json", "type": "file"},
            {"name": "next.config.js", "type": "file"},
            {"name": "src", "type": "dir"},
            {"name": "README.md", "type": "file"},
        ]

        files, dirs = _get_root_entries(client, "owner/repo")

        assert files == {"package.json", "next.config.js", "README.md"}
        assert dirs == {"src"}

    def test_excludes_directories_from_files(self) -> None:
        client = mock.MagicMock()
        client.get.return_value = [
            {"name": "src", "type": "dir"},
            {"name": "lib", "type": "dir"},
        ]

        files, dirs = _get_root_entries(client, "owner/repo")

        assert files == set()
        assert dirs == {"src", "lib"}

    def test_returns_none_on_api_error(self) -> None:
        client = mock.MagicMock()
        client.get.side_effect = ApiError("Not Found", code=404)

        files, dirs = _get_root_entries(client, "owner/repo")

        assert files is None
        assert dirs is None

    def test_passes_ref_param(self) -> None:
        client = mock.MagicMock()
        client.get.return_value = []

        _get_root_entries(client, "owner/repo", ref="main")

        client.get.assert_called_once_with("/repos/owner/repo/contents", params={"ref": "main"})

    def test_skips_malformed_item_but_keeps_valid(self) -> None:
        client = mock.MagicMock()
        client.get.return_value = [
            {"type": "file"},  # missing "name" key — skipped
            {"name": "README.md", "type": "file"},  # valid — kept
        ]

        files, dirs = _get_root_entries(client, "owner/repo")
        assert files == {"README.md"}
        assert dirs == set()

    def test_returns_none_on_non_list_response(self) -> None:
        client = mock.MagicMock()
        client.get.return_value = {"message": "Not Found"}  # dict instead of list

        assert _get_root_entries(client, "owner/repo") == (None, None)


class TestApplySupersession:
    def test_nextjs_supersedes_react(self) -> None:
        results = [
            DetectedPlatform(
                platform="javascript-nextjs",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=99,
            ),
            DetectedPlatform(
                platform="javascript-react",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=70,
            ),
        ]
        filtered = _apply_supersession(results)
        platforms = [r["platform"] for r in filtered]
        assert "javascript-nextjs" in platforms
        assert "javascript-react" not in platforms

    def test_nuxt_supersedes_vue(self) -> None:
        results = [
            DetectedPlatform(
                platform="javascript-nuxt",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=99,
            ),
            DetectedPlatform(
                platform="javascript-vue",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=70,
            ),
        ]
        filtered = _apply_supersession(results)
        platforms = [r["platform"] for r in filtered]
        assert "javascript-nuxt" in platforms
        assert "javascript-vue" not in platforms

    def test_remix_supersedes_react(self) -> None:
        results = [
            DetectedPlatform(
                platform="javascript-remix",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=99,
            ),
            DetectedPlatform(
                platform="javascript-react",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=70,
            ),
        ]
        filtered = _apply_supersession(results)
        platforms = [r["platform"] for r in filtered]
        assert "javascript-remix" in platforms
        assert "javascript-react" not in platforms

    def test_sveltekit_supersedes_svelte(self) -> None:
        results = [
            DetectedPlatform(
                platform="javascript-sveltekit",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=99,
            ),
            DetectedPlatform(
                platform="javascript-svelte",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=70,
            ),
        ]
        filtered = _apply_supersession(results)
        platforms = [r["platform"] for r in filtered]
        assert "javascript-sveltekit" in platforms
        assert "javascript-svelte" not in platforms

    def test_gatsby_supersedes_react(self) -> None:
        results = [
            DetectedPlatform(
                platform="javascript-gatsby",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=99,
            ),
            DetectedPlatform(
                platform="javascript-react",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=70,
            ),
        ]
        filtered = _apply_supersession(results)
        platforms = [r["platform"] for r in filtered]
        assert "javascript-gatsby" in platforms
        assert "javascript-react" not in platforms

    def test_react_native_supersedes_react(self) -> None:
        results = [
            DetectedPlatform(
                platform="react-native",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=99,
            ),
            DetectedPlatform(
                platform="javascript-react",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=70,
            ),
        ]
        filtered = _apply_supersession(results)
        platforms = [r["platform"] for r in filtered]
        assert "react-native" in platforms
        assert "javascript-react" not in platforms

    def test_cloudflare_pages_supersedes_workers(self) -> None:
        results = [
            DetectedPlatform(
                platform="node-cloudflare-pages",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=50,
            ),
            DetectedPlatform(
                platform="node-cloudflare-workers",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=50,
            ),
        ]
        filtered = _apply_supersession(results)
        platforms = [r["platform"] for r in filtered]
        assert "node-cloudflare-pages" in platforms
        assert "node-cloudflare-workers" not in platforms

    def test_no_supersession_keeps_all(self) -> None:
        results = [
            DetectedPlatform(
                platform="javascript-react",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=70,
            ),
            DetectedPlatform(
                platform="node-express",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=60,
            ),
        ]
        filtered = _apply_supersession(results)
        assert len(filtered) == 2

    def test_supersession_does_not_affect_unrelated(self) -> None:
        results = [
            DetectedPlatform(
                platform="javascript-nextjs",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=99,
            ),
            DetectedPlatform(
                platform="node-express",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=60,
            ),
            DetectedPlatform(
                platform="javascript-react",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=70,
            ),
        ]
        filtered = _apply_supersession(results)
        platforms = [r["platform"] for r in filtered]
        assert "javascript-nextjs" in platforms
        assert "node-express" in platforms
        assert "javascript-react" not in platforms


def _make_b64_response(content: str) -> dict:
    """Helper to create a GitHub contents API response with base64-encoded content."""
    return {"content": b64encode(content.encode()).decode()}


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


class TestDetectPlatforms:
    def test_detects_single_language_repo(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Python": 50000}
        client.get.side_effect = ApiError("Not Found", code=404)

        result = detect_platforms(client, "owner/repo")

        assert len(result) == 1
        assert result[0]["platform"] == "python"
        assert result[0]["language"] == "Python"
        assert result[0]["bytes"] == 50000
        assert result[0]["confidence"] == "medium"
        assert result[0]["priority"] == 1

    def test_only_top_language_platform_detected(self) -> None:
        """Only the top language's base platform is processed."""
        client = mock.MagicMock()
        client.get_languages.return_value = {"Python": 50000, "JavaScript": 30000}
        client.get.side_effect = ApiError("Not Found", code=404)

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "python" in platforms
        assert "javascript" not in platforms

    def test_filters_ignored_languages(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {
            "Python": 50000,
            "Shell": 5000,
            "Makefile": 1000,
            "Dockerfile": 500,
        }
        client.get.side_effect = ApiError("Not Found", code=404)

        result = detect_platforms(client, "owner/repo")

        languages = [r["language"] for r in result]
        assert "Python" in languages
        assert "Shell" not in languages
        assert "Makefile" not in languages
        assert "Dockerfile" not in languages

    def test_powershell_detected_as_base_platform(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"PowerShell": 20000}
        client.get.side_effect = ApiError("Not Found", code=404)

        result = detect_platforms(client, "owner/repo")

        assert len(result) == 1
        assert result[0]["platform"] == "powershell"

    def test_framework_detection_gives_high_confidence(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Python": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "requirements.txt", "type": "file"}]
            if "requirements.txt" in path:
                return _make_b64_response("Django==4.2\n")
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        django_result = next(r for r in result if r["platform"] == "python-django")
        assert django_result["confidence"] == "high"

        python_result = next(r for r in result if r["platform"] == "python")
        assert python_result["confidence"] == "medium"

    def test_results_sorted_by_bytes_then_priority(self) -> None:
        """Frameworks for the top language are sorted by (bytes, priority)."""
        client = mock.MagicMock()
        client.get_languages.return_value = {"Python": 80000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "requirements.txt", "type": "file"},
                    {"name": "manage.py", "type": "file"},
                ]
            if "requirements.txt" in path:
                return _make_b64_response("flask==3.0\ncelery>=5.0\n")
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        # Flask (sort=10, priority=90) should rank above Celery (sort=50, priority=50)
        flask_idx = platforms.index("python-flask")
        celery_idx = platforms.index("python-celery")
        assert flask_idx < celery_idx

    def test_nextjs_supersedes_react_in_full_flow(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"JavaScript": 50000}

        content = json.dumps(
            {"dependencies": {"next": "^14.0.0", "react": "^18.0.0", "express": "^4.0.0"}}
        )

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "package.json", "type": "file"}]
            if "package.json" in path:
                return _make_b64_response(content)
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "javascript-nextjs" in platforms
        assert "node-express" in platforms
        assert "javascript-react" not in platforms
        assert "javascript" in platforms

    def test_framework_sort_determines_ranking(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"JavaScript": 50000}

        content = json.dumps(
            {
                "dependencies": {"express": "^4.0.0"},
                "devDependencies": {"svelte": "^4.0.0"},
            }
        )

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "package.json", "type": "file"}]
            if "package.json" in path:
                return _make_b64_response(content)
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        svelte = next(r for r in result if r["platform"] == "javascript-svelte")
        express = next(r for r in result if r["platform"] == "node-express")
        # svelte sort=10 → priority=90, express sort=20 → priority=80
        assert svelte["priority"] == 90
        assert express["priority"] == 80

    def test_typescript_and_javascript_deduplicated(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"TypeScript": 40000, "JavaScript": 10000}
        client.get.side_effect = ApiError("Not Found", code=404)

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert platforms.count("javascript") == 1

    def test_empty_repo_returns_empty(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {}
        client.get.return_value = []

        result = detect_platforms(client, "owner/repo")

        assert result == []

    def test_only_ignored_languages_returns_empty(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Shell": 5000, "Makefile": 1000}
        client.get.return_value = []

        result = detect_platforms(client, "owner/repo")

        assert result == []

    def test_priority_field_present_in_results(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Python": 50000}
        client.get.side_effect = ApiError("Not Found", code=404)

        result = detect_platforms(client, "owner/repo")

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
        client = mock.MagicMock()
        client.get_languages.return_value = {language: 10000}
        client.get.side_effect = ApiError("Not Found", code=404)

        result = detect_platforms(client, "owner/repo")

        assert len(result) >= 1
        assert result[0]["platform"] == expected_platform

    def test_config_file_detects_nextjs_without_dep(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"JavaScript": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "next.config.js", "type": "file"},
                    {"name": "package.json", "type": "file"},
                ]
            if "package.json" in path:
                return _make_b64_response(json.dumps({"dependencies": {"react": "^18.0.0"}}))
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "javascript-nextjs" in platforms
        # React is superseded by Next.js
        assert "javascript-react" not in platforms

    def test_config_file_sets_high_priority(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"JavaScript": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "next.config.js", "type": "file"},
                    {"name": "package.json", "type": "file"},
                ]
            if "package.json" in path:
                return _make_b64_response(json.dumps({"dependencies": {"next": "^14.0.0"}}))
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        nextjs = next(r for r in result if r["platform"] == "javascript-nextjs")
        # sort=1 → priority=99
        assert nextjs["priority"] == 99

    def test_config_file_only_detection(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"JavaScript": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "next.config.js", "type": "file"},
                    {"name": "package.json", "type": "file"},
                ]
            if "package.json" in path:
                return _make_b64_response(json.dumps({"dependencies": {}}))
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        nextjs = next(r for r in result if r["platform"] == "javascript-nextjs")
        # sort=1 → priority=99 (same regardless of dep presence)
        assert nextjs["priority"] == 99

    def test_manage_py_detects_django(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Python": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "manage.py", "type": "file"},
                    {"name": "requirements.txt", "type": "file"},
                ]
            if "requirements.txt" in path:
                return _make_b64_response("Django==4.2\n")
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        django = next(r for r in result if r["platform"] == "python-django")
        assert django["confidence"] == "high"
        # sort=10 → priority=90
        assert django["priority"] == 90

    def test_base_platform_priority_is_one(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Python": 50000}
        client.get.side_effect = ApiError("Not Found", code=404)

        result = detect_platforms(client, "owner/repo")

        assert result[0]["platform"] == "python"
        assert result[0]["priority"] == 1

    def test_multiple_frameworks_same_platform(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Python": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "manage.py", "type": "file"},
                    {"name": "requirements.txt", "type": "file"},
                ]
            if "requirements.txt" in path:
                return _make_b64_response("Django==4.2\ncelery>=5.0\n")
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "python-django" in platforms
        assert "python-celery" in platforms
        assert "python" in platforms

    def test_no_root_files_only_base_platforms(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Python": 50000, "JavaScript": 30000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return []
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert platforms == ["python"]
        assert result[0]["confidence"] == "medium"
        assert result[0]["priority"] == 1

    def test_root_listing_failure_still_detects_frameworks_via_manifest(self) -> None:
        """When the root contents API fails, framework detection should fall
        back to fetching manifest files individually rather than returning
        only base platforms."""
        client = mock.MagicMock()
        client.get_languages.return_value = {"Python": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                raise ApiError("Server Error", code=500)
            if path.endswith("/contents/requirements.txt"):
                return {
                    "content": b64encode(b"Django>=4.0\ncelery>=5.0").decode(),
                    "encoding": "base64",
                }
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "python-django" in platforms

    def test_laravel_detected_from_artisan(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"PHP": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "artisan", "type": "file"}]
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "php-laravel" in platforms

    def test_spring_boot_detected_from_build_gradle(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Java": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "build.gradle", "type": "file"}]
            if "build.gradle" in path:
                return _make_b64_response(
                    "dependencies {\n    implementation 'org.springframework.boot:spring-boot-starter'\n}\n"
                )
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "java-spring-boot" in platforms

    def test_go_gin_detected_from_go_mod(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Go": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "go.mod", "type": "file"}]
            if "go.mod" in path:
                return _make_b64_response(
                    "module example.com/myapp\n\nrequire github.com/gin-gonic/gin v1.9.1\n"
                )
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "go-gin" in platforms

    def test_react_native_detected_and_supersedes_react(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"JavaScript": 50000}

        content = json.dumps({"dependencies": {"react-native": "^0.72.0", "react": "^18.0.0"}})

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "package.json", "type": "file"}]
            if "package.json" in path:
                return _make_b64_response(content)
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "react-native" in platforms
        assert "javascript-react" not in platforms

    def test_electron_detected(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"JavaScript": 50000}

        content = json.dumps({"dependencies": {"electron": "^28.0.0"}})

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "package.json", "type": "file"}]
            if "package.json" in path:
                return _make_b64_response(content)
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "electron" in platforms

    def test_flutter_detected_from_pubspec(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Dart": 50000}

        pubspec_content = (
            "name: my_app\ndependencies:\n  flutter:\n    sdk: flutter\n  http: ^0.13.5\n"
        )

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "pubspec.yaml", "type": "file"}]
            if "pubspec.yaml" in path:
                return _make_b64_response(pubspec_content)
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "flutter" in platforms

    def test_unity_detected_from_directories(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"C#": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "Assets", "type": "dir"},
                    {"name": "ProjectSettings", "type": "dir"},
                    {"name": "Packages", "type": "dir"},
                    {"name": "README.md", "type": "file"},
                ]
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "unity" in platforms

    def test_android_detected_from_build_gradle_and_app_dir(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Java": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "app", "type": "dir"},
                    {"name": "build.gradle", "type": "file"},
                    {"name": "settings.gradle", "type": "file"},
                ]
            if "build.gradle" in path:
                return _make_b64_response(
                    "buildscript {\n}\n\nallprojects {\n}\n\nandroid {\n    compileSdk 34\n}\n"
                )
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "android" in platforms

    def test_dotnet_aspnetcore_detected_with_csproj_and_appsettings(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"C#": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "MyApp.csproj", "type": "file"},
                    {"name": "Program.cs", "type": "file"},
                    {"name": "appsettings.json", "type": "file"},
                ]
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "dotnet-aspnetcore" in platforms

    def test_dotnet_csproj_without_appsettings_falls_back_to_base(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"C#": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "MyApp.csproj", "type": "file"},
                    {"name": "Program.cs", "type": "file"},
                ]
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "dotnet-aspnetcore" not in platforms
        assert "dotnet" in platforms

    def test_unreal_detected_from_uproject(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"C++": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "MyGame.uproject", "type": "file"},
                    {"name": "Source", "type": "dir"},
                ]
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "unreal" in platforms

    def test_godot_detected_from_project_file(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"GDScript": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "project.godot", "type": "file"},
                    {"name": "scenes", "type": "dir"},
                ]
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "godot" in platforms

    def test_wordpress_filtered_as_non_selectable(self) -> None:
        """WordPress is detected internally but filtered from results as non-selectable."""
        client = mock.MagicMock()
        client.get_languages.return_value = {"PHP": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "wp-config.php", "type": "file"}]
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "php-wordpress" not in platforms
        assert "php" in platforms

    def test_ruby_rack_detected_from_gemfile(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Ruby": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "Gemfile", "type": "file"}]
            if "Gemfile" in path:
                return _make_b64_response('gem "rack"\ngem "puma"\n')
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "ruby-rack" in platforms

    def test_python_aiohttp_detected(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Python": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "requirements.txt", "type": "file"}]
            if "requirements.txt" in path:
                return _make_b64_response("aiohttp==3.9.0\n")
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "python-aiohttp" in platforms

    def test_java_log4j2_detected(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Java": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "build.gradle", "type": "file"}]
            if "build.gradle" in path:
                return _make_b64_response(
                    "dependencies {\n    implementation 'org.apache.logging.log4j:log4j-core:2.20'\n}\n"
                )
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "java-log4j2" in platforms

    def test_astro_detected(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"JavaScript": 50000}

        content = json.dumps({"dependencies": {"astro": "^4.0.0"}})

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "package.json", "type": "file"}]
            if "package.json" in path:
                return _make_b64_response(content)
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "javascript-astro" in platforms

    def test_sveltekit_supersedes_svelte_in_full_flow(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"JavaScript": 50000}

        content = json.dumps(
            {
                "dependencies": {},
                "devDependencies": {"@sveltejs/kit": "^2.0.0", "svelte": "^4.0.0"},
            }
        )

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "package.json", "type": "file"}]
            if "package.json" in path:
                return _make_b64_response(content)
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "javascript-sveltekit" in platforms
        assert "javascript-svelte" not in platforms

    def test_nestjs_detected(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"TypeScript": 50000}

        content = json.dumps({"dependencies": {"@nestjs/core": "^10.0.0"}})

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "package.json", "type": "file"}]
            if "package.json" in path:
                return _make_b64_response(content)
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "node-nestjs" in platforms

    def test_cloudflare_workers_detected_from_wrangler(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"JavaScript": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "wrangler.toml", "type": "file"},
                    {"name": "package.json", "type": "file"},
                ]
            if "package.json" in path:
                return _make_b64_response(json.dumps({"dependencies": {}}))
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "node-cloudflare-workers" in platforms

    def test_cloudflare_pages_supersedes_workers(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"JavaScript": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "wrangler.toml", "type": "file"},
                    {"name": "package.json", "type": "file"},
                ]
            if "wrangler.toml" in path:
                return _make_b64_response(
                    'name = "my-pages-app"\npages_build_output_dir = "./dist"\n'
                )
            if "package.json" in path:
                return _make_b64_response(json.dumps({"dependencies": {}}))
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "node-cloudflare-pages" in platforms
        assert "node-cloudflare-workers" not in platforms

    def test_azurefunctions_detected_from_host_and_local_settings(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"JavaScript": 50000}

        host_json = '{"version": "2.0", "extensionBundle": {"id": "Microsoft.Azure.Functions.ExtensionBundle"}}'

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "host.json", "type": "file"},
                    {"name": "local.settings.json", "type": "file"},
                    {"name": "package.json", "type": "file"},
                ]
            if "host.json" in path:
                return _make_b64_response(host_json)
            if "package.json" in path:
                return _make_b64_response(json.dumps({"dependencies": {}}))
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "node-azurefunctions" in platforms

    def test_azurefunctions_not_detected_without_extension_bundle(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"JavaScript": 50000}

        host_json = '{"version": "2.0"}'

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "host.json", "type": "file"},
                    {"name": "local.settings.json", "type": "file"},
                    {"name": "package.json", "type": "file"},
                ]
            if "host.json" in path:
                return _make_b64_response(host_json)
            if "package.json" in path:
                return _make_b64_response(json.dumps({"dependencies": {}}))
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "node-azurefunctions" not in platforms

    def test_serverless_yml_detects_awslambda(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Python": 50000}

        serverless_content = b64encode(
            b"service: my-service\nprovider:\n  runtime: python3.11\n"
        ).decode()

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "serverless.yml", "type": "file"},
                    {"name": "requirements.txt", "type": "file"},
                ]
            if path.endswith("/contents/serverless.yml"):
                return {"content": serverless_content}
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "python-awslambda" in platforms

    def test_bun_detected_from_bunfig(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"TypeScript": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "bunfig.toml", "type": "file"},
                    {"name": "package.json", "type": "file"},
                ]
            if "package.json" in path:
                return _make_b64_response(json.dumps({"dependencies": {}}))
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")
        platforms = [r["platform"] for r in result]
        assert "bun" in platforms

    def test_bun_detected_from_lockfile(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"JavaScript": 30000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "bun.lockb", "type": "file"},
                    {"name": "package.json", "type": "file"},
                ]
            if "package.json" in path:
                return _make_b64_response(json.dumps({"dependencies": {}}))
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")
        platforms = [r["platform"] for r in result]
        assert "bun" in platforms

    def test_deno_detected_from_config(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"TypeScript": 40000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "deno.json", "type": "file"},
                    {"name": "package.json", "type": "file"},
                ]
            if "package.json" in path:
                return _make_b64_response(json.dumps({"dependencies": {}}))
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")
        platforms = [r["platform"] for r in result]
        assert "deno" in platforms

    def test_dotnet_maui_detected_from_csproj_content(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"C#": 60000}

        csproj_content = """<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFrameworks>net8.0-android;net8.0-ios</TargetFrameworks>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.Maui.Controls" Version="8.0.0" />
  </ItemGroup>
</Project>"""

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "MyApp.csproj", "type": "file"},
                    {"name": "MauiProgram.cs", "type": "file"},
                ]
            if "MyApp.csproj" in path:
                return _make_b64_response(csproj_content)
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")
        platforms = [r["platform"] for r in result]
        assert "dotnet-maui" in platforms

    def test_dotnet_wpf_detected_from_csproj_content(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"C#": 50000}

        csproj_content = """<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <UseWPF>true</UseWPF>
  </PropertyGroup>
</Project>"""

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "WpfApp.csproj", "type": "file"},
                ]
            if "WpfApp.csproj" in path:
                return _make_b64_response(csproj_content)
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")
        platforms = [r["platform"] for r in result]
        assert "dotnet-wpf" in platforms

    def test_dotnet_awslambda_detected_from_csproj_content(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"C#": 30000}

        csproj_content = """<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Amazon.Lambda.Core" Version="2.1.0" />
    <PackageReference Include="Amazon.Lambda.Serialization.SystemTextJson" />
  </ItemGroup>
</Project>"""

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "LambdaFunc.csproj", "type": "file"},
                ]
            if "LambdaFunc.csproj" in path:
                return _make_b64_response(csproj_content)
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")
        platforms = [r["platform"] for r in result]
        assert "dotnet-awslambda" in platforms

    def test_dotnet_aspnet_legacy_detected_not_core(self) -> None:
        """dotnet-aspnet detects legacy ASP.NET but not ASP.NET Core."""
        client = mock.MagicMock()
        client.get_languages.return_value = {"C#": 40000}

        csproj_content = """<Project>
  <ItemGroup>
    <Reference Include="Microsoft.AspNet.Mvc" />
  </ItemGroup>
</Project>"""

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "WebApp.csproj", "type": "file"},
                ]
            if "WebApp.csproj" in path:
                return _make_b64_response(csproj_content)
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")
        platforms = [r["platform"] for r in result]
        assert "dotnet-aspnet" in platforms

    def test_dotnet_aspnetcore_not_detected_as_legacy_aspnet(self) -> None:
        """ASP.NET Core references should NOT match the legacy dotnet-aspnet pattern."""
        client = mock.MagicMock()
        client.get_languages.return_value = {"C#": 40000}

        csproj_content = """<Project Sdk="Microsoft.NET.Sdk.Web">
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.App" />
  </ItemGroup>
</Project>"""

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "WebApp.csproj", "type": "file"},
                    {"name": "appsettings.json", "type": "file"},
                ]
            if "WebApp.csproj" in path:
                return _make_b64_response(csproj_content)
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")
        platforms = [r["platform"] for r in result]
        # Should detect aspnetcore (via existing rule), not legacy aspnet
        assert "dotnet-aspnetcore" in platforms
        assert "dotnet-aspnet" not in platforms

    def test_apple_ios_detected_from_package_swift(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Swift": 40000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "Package.swift", "type": "file"}]
            if "Package.swift" in path:
                return _make_b64_response("let package = Package(\n  platforms: [.iOS(.v14)],\n)")
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")
        platforms = [r["platform"] for r in result]
        assert "apple-ios" in platforms

    def test_apple_ios_detected_from_podfile(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Swift": 40000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "Podfile", "type": "file"}]
            if "Podfile" in path:
                return _make_b64_response("platform :ios, '14.0'\npod 'Alamofire'\n")
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")
        platforms = [r["platform"] for r in result]
        assert "apple-ios" in platforms

    def test_objc_dominant_repo_returns_apple_ios_base(self) -> None:
        """When Objective-C dominates, apple-ios is returned as the base
        platform (medium confidence) since framework detection for apple-ios
        runs under the swift base platform which isn't processed."""
        client = mock.MagicMock()
        client.get_languages.return_value = {
            "Objective-C": 80000,
            "Swift": 20000,
        }

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "MyApp.xcodeproj", "type": "dir"},
                ]
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")
        ios_entry = next(r for r in result if r["platform"] == "apple-ios")
        assert ios_entry["confidence"] == "medium"
        assert ios_entry["bytes"] == 80000

    def test_apple_ios_higher_priority_than_macos(self) -> None:
        """When both iOS and macOS are in Package.swift, iOS should rank higher."""
        client = mock.MagicMock()
        client.get_languages.return_value = {"Swift": 40000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "Package.swift", "type": "file"}]
            if "Package.swift" in path:
                return _make_b64_response(
                    "let package = Package(\n  platforms: [.iOS(.v14), .macOS(.v11)],\n)"
                )
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")
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
        client = mock.MagicMock()
        client.get_languages.return_value = {"Swift": 40000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "README.md", "type": "file"}]
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")
        assert result == []

    def test_apple_macos_detected_from_package_swift(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Swift": 40000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "Package.swift", "type": "file"}]
            if "Package.swift" in path:
                return _make_b64_response(
                    'let package = Package(\n  platforms: [.macOS("12.0")],\n)'
                )
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")
        platforms = [r["platform"] for r in result]
        assert "apple-macos" in platforms

    def test_apple_macos_detected_from_podfile(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Swift": 40000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "Podfile", "type": "file"}]
            if "Podfile" in path:
                return _make_b64_response("platform :osx, '12.0'\npod 'Alamofire'\n")
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")
        platforms = [r["platform"] for r in result]
        assert "apple-macos" in platforms

    def test_native_qt_detected_from_qrc(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"C++": 30000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "resources.qrc", "type": "file"}]
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")
        platforms = [r["platform"] for r in result]
        assert "native-qt" in platforms

    def test_native_qt_detected_from_cmake(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"C++": 30000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "CMakeLists.txt", "type": "file"}]
            if "CMakeLists.txt" in path:
                return _make_b64_response(
                    "cmake_minimum_required(VERSION 3.16)\nfind_package(Qt6 REQUIRED)\n"
                )
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")
        platforms = [r["platform"] for r in result]
        assert "native-qt" in platforms

    def test_cordova_detected_from_config_xml(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"JavaScript": 20000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "config.xml", "type": "file"},
                    {"name": "package.json", "type": "file"},
                ]
            if "config.xml" in path:
                return _make_b64_response(
                    '<widget xmlns="http://cordova.apache.org/ns/1.0">\n'
                    "  <name>MyApp</name>\n"
                    "</widget>\n"
                )
            if "package.json" in path:
                return _make_b64_response(json.dumps({"dependencies": {}}))
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")
        platforms = [r["platform"] for r in result]
        assert "cordova" in platforms

    def test_cordova_detected_from_package_json(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"JavaScript": 20000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "package.json", "type": "file"}]
            if "package.json" in path:
                return _make_b64_response(
                    json.dumps({"dependencies": {"cordova-android": "^12.0.0"}})
                )
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")
        platforms = [r["platform"] for r in result]
        assert "cordova" in platforms

    def test_node_detected_from_nvmrc(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"JavaScript": 30000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": ".nvmrc", "type": "file"},
                    {"name": "package.json", "type": "file"},
                ]
            if "package.json" in path:
                return _make_b64_response(json.dumps({"dependencies": {}}))
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")
        platforms = [r["platform"] for r in result]
        assert "node" in platforms

    def test_engines_node_alone_does_not_trigger_node(self) -> None:
        """engines.node is too common in JS ecosystem (even browser libs set it)
        so it should not by itself trigger Node detection."""
        client = mock.MagicMock()
        client.get_languages.return_value = {"JavaScript": 30000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "package.json", "type": "file"}]
            if "package.json" in path:
                return _make_b64_response(
                    json.dumps(
                        {
                            "engines": {"node": ">=18.0.0"},
                            "dependencies": {},
                        }
                    )
                )
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")
        platforms = [r["platform"] for r in result]
        assert "node" not in platforms
        assert "javascript" in platforms

    def test_go_base_platform_when_no_framework(self) -> None:
        """Go with no framework should emit plain 'go'."""
        client = mock.MagicMock()
        client.get_languages.return_value = {"Go": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "main.go", "type": "file"}]
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")
        platforms = [r["platform"] for r in result]
        assert "go" in platforms

    def test_go_with_framework_emits_framework_and_base(self) -> None:
        """Go with a framework should emit both the framework and base 'go' platform."""
        client = mock.MagicMock()
        client.get_languages.return_value = {"Go": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "go.mod", "type": "file"}]
            if "go.mod" in path:
                return _make_b64_response(
                    "module example.com/app\n\nrequire github.com/gin-gonic/gin v1.9.1\n"
                )
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")
        platforms = [r["platform"] for r in result]
        assert "go-gin" in platforms
        assert "go" in platforms

    def test_python_asgi_detected_from_uvicorn(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Python": 40000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [{"name": "requirements.txt", "type": "file"}]
            if "requirements.txt" in path:
                return _make_b64_response("fastapi\nuvicorn\npydantic\n")
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")
        platforms = [r["platform"] for r in result]
        assert "python-asgi" in platforms
        assert "python-fastapi" in platforms

    def test_python_wsgi_detected_from_gunicorn(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Python": 40000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "requirements.txt", "type": "file"},
                    {"name": "manage.py", "type": "file"},
                ]
            if "requirements.txt" in path:
                return _make_b64_response("Django==4.2\ngunicorn\npsycopg2\n")
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")
        platforms = [r["platform"] for r in result]
        assert "python-wsgi" in platforms
        assert "python-django" in platforms


class TestFrameworksIntegrity:
    """Validate the FRAMEWORKS list is internally consistent.

    Catches typos and structural errors that would silently cause
    framework definitions to never match at runtime.
    """

    def test_no_unintentional_duplicate_platform_ids(self) -> None:
        # Some platforms intentionally have multiple entries with different
        # base_platforms (e.g. android has both java and kotlin entries).
        # Duplicates are only valid when each entry has a distinct base_platform.
        from collections import Counter

        entries = [(fw["platform"], fw["base_platform"]) for fw in FRAMEWORKS]
        entry_counts = Counter(entries)
        exact_dupes = [e for e, count in entry_counts.items() if count > 1]
        assert exact_dupes == [], f"Duplicate (platform, base_platform) pairs: {exact_dupes}"

    def test_all_base_platforms_are_valid(self) -> None:
        valid_base_platforms = set(GITHUB_LANGUAGE_TO_SENTRY_PLATFORM.values())
        for fw in FRAMEWORKS:
            assert fw["base_platform"] in valid_base_platforms, (
                f"{fw['platform']} has base_platform={fw['base_platform']!r} "
                f"which is not a value in GITHUB_LANGUAGE_TO_SENTRY_PLATFORM"
            )

    def test_all_supersedes_targets_exist(self) -> None:
        all_platform_ids = {fw["platform"] for fw in FRAMEWORKS}
        all_base_platforms = set(GITHUB_LANGUAGE_TO_SENTRY_PLATFORM.values())
        valid_targets = all_platform_ids | all_base_platforms

        for fw in FRAMEWORKS:
            for target in fw.get("supersedes", []):
                assert target in valid_targets, (
                    f"{fw['platform']} supersedes {target!r} "
                    f"which does not exist as a framework or base platform"
                )

    def test_every_framework_has_at_least_one_rule(self) -> None:
        for fw in FRAMEWORKS:
            has_rules = fw.get("every") or fw.get("some")
            assert has_rules, f"{fw['platform']} has no detection rules (no every or some)"

    def test_sort_values_are_positive_integers(self) -> None:
        for fw in FRAMEWORKS:
            assert isinstance(fw["sort"], int), (
                f"{fw['platform']} sort={fw['sort']!r} is not an int"
            )
            assert 1 <= fw["sort"] <= 99, (
                f"{fw['platform']} sort={fw['sort']} is outside valid range 1-99"
            )

    def test_no_rule_has_match_content_without_file_source(self) -> None:
        for fw in FRAMEWORKS:
            for rule in [*fw.get("every", []), *fw.get("some", [])]:
                if "match_content" in rule:
                    assert "path" in rule or "match_ext" in rule, (
                        f"{fw['platform']} has match_content without path or match_ext — "
                        f"content matching requires a file source to read"
                    )


class TestDetectPlatformsMultiStack:
    """Test detection against a realistic multi-language, multi-framework repo.

    Simulates a repo like a typical full-stack app with:
    - Python backend (Django + Celery)
    - JavaScript frontend (Next.js with React)
    - Go microservice (Gin)
    - Plus build/infra languages that should be ignored
    """

    def test_full_stack_repo_only_detects_top_language(self) -> None:
        """In a multi-language repo, only the top language's platform is
        processed. Only one suggestion is shown to the user."""
        client = mock.MagicMock()
        client.get_languages.return_value = {
            "Python": 120000,
            "JavaScript": 80000,
            "TypeScript": 60000,
            "Go": 40000,
            "HTML": 15000,
            "CSS": 10000,
            "Shell": 5000,
            "Makefile": 2000,
            "Dockerfile": 1000,
        }

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "manage.py", "type": "file"},
                    {"name": "requirements.txt", "type": "file"},
                    {"name": "package.json", "type": "file"},
                    {"name": "go.mod", "type": "file"},
                    {"name": "next.config.js", "type": "file"},
                    {"name": "Dockerfile", "type": "file"},
                    {"name": "Makefile", "type": "file"},
                    {"name": "src", "type": "dir"},
                    {"name": "frontend", "type": "dir"},
                    {"name": "services", "type": "dir"},
                ]
            if "requirements.txt" in path:
                return _make_b64_response(
                    "Django==4.2\ncelery>=5.3\ngunicorn\npsycopg2-binary\nredis\n"
                )
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")
        platform_set = {r["platform"] for r in result}

        # Only Python frameworks detected (top language)
        assert "python-django" in platform_set
        assert "python-celery" in platform_set
        assert "python-wsgi" in platform_set
        assert "python" in platform_set

        # Other languages not processed
        assert "javascript-nextjs" not in platform_set
        assert "go-gin" not in platform_set
        assert "javascript" not in platform_set
        assert "go" not in platform_set

        # Priority ordering within Python: frameworks > utilities > base
        django = next(r for r in result if r["platform"] == "python-django")
        celery = next(r for r in result if r["platform"] == "python-celery")
        python_base = next(r for r in result if r["platform"] == "python")

        assert django["priority"] > celery["priority"]
        assert celery["priority"] > python_base["priority"]
        assert python_base["priority"] == 1

        # Results are sorted by (bytes, priority) descending
        for i in range(len(result) - 1):
            a, b = result[i], result[i + 1]
            assert (a["bytes"], a["priority"]) >= (b["bytes"], b["priority"])
