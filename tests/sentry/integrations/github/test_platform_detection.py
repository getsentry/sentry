from __future__ import annotations

from base64 import b64encode
from unittest import mock

import pytest

from sentry.integrations.github.platform_detection import (
    GITHUB_LANGUAGE_TO_SENTRY_PLATFORM,
    DetectedPlatform,
    DetectorRule,
    FrameworkDef,
    _apply_supersession,
    _framework_matches,
    _get_repo_file_content,
    _get_root_file_names,
    _package_in_manifest,
    _PackageManifest,
    _parse_package_manifest,
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

    def test_nextjs_matches_from_package(self) -> None:
        from sentry.integrations.github.platform_detection import FRAMEWORKS

        nextjs = next(fw for fw in FRAMEWORKS if fw["platform"] == "javascript-nextjs")
        manifest = _PackageManifest(dependencies={"next", "react"}, dev_dependencies=set())
        assert _framework_matches(nextjs, set(), {}, manifest) is True

    def test_nextjs_matches_from_config_file(self) -> None:
        from sentry.integrations.github.platform_detection import FRAMEWORKS

        nextjs = next(fw for fw in FRAMEWORKS if fw["platform"] == "javascript-nextjs")
        assert _framework_matches(nextjs, {"next.config.js"}, {}, None) is True

    def test_django_matches_from_manage_py(self) -> None:
        from sentry.integrations.github.platform_detection import FRAMEWORKS

        django = next(fw for fw in FRAMEWORKS if fw["platform"] == "python-django")
        assert _framework_matches(django, {"manage.py"}, {}, None) is True

    def test_django_matches_from_requirements_content(self) -> None:
        from sentry.integrations.github.platform_detection import FRAMEWORKS

        django = next(fw for fw in FRAMEWORKS if fw["platform"] == "python-django")
        assert (
            _framework_matches(
                django, set(), {"requirements.txt": "Django==4.2\ncelery>=5.0\n"}, None
            )
            is True
        )


class TestGetRootFileNames:
    def test_returns_file_names(self) -> None:
        client = mock.MagicMock()
        client.get.return_value = [
            {"name": "package.json", "type": "file"},
            {"name": "next.config.js", "type": "file"},
            {"name": "src", "type": "dir"},
            {"name": "README.md", "type": "file"},
        ]

        result = _get_root_file_names(client, "owner/repo")

        assert result == {"package.json", "next.config.js", "README.md"}

    def test_excludes_directories(self) -> None:
        client = mock.MagicMock()
        client.get.return_value = [
            {"name": "src", "type": "dir"},
            {"name": "lib", "type": "dir"},
        ]

        result = _get_root_file_names(client, "owner/repo")

        assert result == set()

    def test_returns_empty_on_api_error(self) -> None:
        client = mock.MagicMock()
        client.get.side_effect = ApiError("Not Found", code=404)

        result = _get_root_file_names(client, "owner/repo")

        assert result == set()

    def test_passes_ref_param(self) -> None:
        client = mock.MagicMock()
        client.get.return_value = []

        _get_root_file_names(client, "owner/repo", ref="main")

        client.get.assert_called_once_with("/repos/owner/repo/contents", params={"ref": "main"})

    def test_returns_empty_on_malformed_item(self) -> None:
        client = mock.MagicMock()
        client.get.return_value = [{"type": "file"}]  # missing "name" key

        assert _get_root_file_names(client, "owner/repo") == set()

    def test_returns_empty_on_non_list_response(self) -> None:
        client = mock.MagicMock()
        client.get.return_value = {"message": "Not Found"}  # dict instead of list

        assert _get_root_file_names(client, "owner/repo") == set()


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

    def test_detects_multi_language_repo(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Python": 50000, "JavaScript": 30000}
        client.get.side_effect = ApiError("Not Found", code=404)

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "python" in platforms
        assert "javascript" in platforms

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

    def test_results_sorted_by_priority_then_bytes(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Python": 80000, "JavaScript": 30000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents"):
                return [
                    {"name": "requirements.txt", "type": "file"},
                    {"name": "package.json", "type": "file"},
                ]
            if "requirements.txt" in path:
                return _make_b64_response("flask==3.0\n")
            if "package.json" in path:
                return _make_b64_response(
                    json.dumps({"dependencies": {"next": "^14.0.0", "react": "^18.0.0"}})
                )
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        # Next.js (priority=99) > Flask (priority=80) > base platforms (priority=1)
        platforms = [r["platform"] for r in result]
        nextjs_idx = platforms.index("javascript-nextjs")
        flask_idx = platforms.index("python-flask")
        assert nextjs_idx < flask_idx

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
        # svelte sort=30 → priority=70, express sort=40 → priority=60
        assert svelte["priority"] == 70
        assert express["priority"] == 60

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
            ("Swift", "swift"),
            ("Go", "go"),
            ("Ruby", "ruby"),
            ("PHP", "php"),
            ("Rust", "rust"),
            ("C#", "dotnet"),
            ("Dart", "dart"),
            ("Elixir", "elixir"),
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
        assert platforms == ["python", "javascript"] or set(platforms) == {
            "python",
            "javascript",
        }
        for r in result:
            assert r["confidence"] == "medium"
            assert r["priority"] == 1

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
