from __future__ import annotations

from base64 import b64encode
from unittest import mock

import pytest

from sentry.integrations.github.platform_detection import (
    BASE_PLATFORM_PRIORITY,
    CONFIG_FILE_BONUS,
    FRAMEWORK_PRIORITY,
    GITHUB_LANGUAGE_TO_SENTRY_PLATFORM,
    DetectedPlatform,
    _apply_supersession,
    _detect_frameworks_from_content,
    _detect_from_config_files,
    _get_root_file_names,
    detect_framework,
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
        assert GITHUB_LANGUAGE_TO_SENTRY_PLATFORM.get("Brainfuck") is None


class TestDetectFrameworksFromContent:
    def test_package_json_detects_next(self) -> None:
        content = json.dumps({"dependencies": {"next": "^14.0.0", "react": "^18.0.0"}})
        result = _detect_frameworks_from_content(
            content, "package.json", {"next": "javascript-nextjs", "react": "javascript-react"}
        )
        platforms = [m["platform"] for m in result]
        assert "javascript-nextjs" in platforms
        assert "javascript-react" in platforms
        # Both are in prod deps
        for m in result:
            assert m["dep_source"] == "dependencies"

    def test_package_json_checks_dev_dependencies(self) -> None:
        content = json.dumps({"devDependencies": {"svelte": "^4.0.0"}})
        result = _detect_frameworks_from_content(
            content, "package.json", {"svelte": "javascript-svelte"}
        )
        assert len(result) == 1
        assert result[0]["platform"] == "javascript-svelte"
        assert result[0]["dep_source"] == "devDependencies"

    def test_package_json_prefers_prod_over_dev(self) -> None:
        content = json.dumps(
            {"dependencies": {"react": "^18.0.0"}, "devDependencies": {"react": "^18.0.0"}}
        )
        result = _detect_frameworks_from_content(
            content, "package.json", {"react": "javascript-react"}
        )
        assert len(result) == 1
        assert result[0]["dep_source"] == "dependencies"

    def test_package_json_no_match(self) -> None:
        content = json.dumps({"dependencies": {"lodash": "^4.0.0"}})
        result = _detect_frameworks_from_content(
            content, "package.json", {"next": "javascript-nextjs"}
        )
        assert result == []

    def test_package_json_invalid_json(self) -> None:
        result = _detect_frameworks_from_content(
            "not valid json", "package.json", {"next": "javascript-nextjs"}
        )
        assert result == []

    def test_requirements_txt_detects_django(self) -> None:
        content = "Django==4.2\ncelery>=5.0\nredis\n"
        result = _detect_frameworks_from_content(
            content,
            "requirements.txt",
            {"django": "python-django", "celery": "python-celery"},
        )
        platforms = [m["platform"] for m in result]
        assert "python-django" in platforms
        assert "python-celery" in platforms
        for m in result:
            assert m["dep_source"] == "unknown"

    def test_requirements_txt_case_insensitive(self) -> None:
        content = "Flask==3.0\n"
        result = _detect_frameworks_from_content(
            content, "requirements.txt", {"flask": "python-flask"}
        )
        assert len(result) == 1
        assert result[0]["platform"] == "python-flask"

    def test_gemfile_detects_rails(self) -> None:
        content = 'gem "rails", "~> 7.0"\ngem "pg"\n'
        result = _detect_frameworks_from_content(content, "Gemfile", {"rails": "ruby-rails"})
        assert len(result) == 1
        assert result[0]["platform"] == "ruby-rails"

    def test_composer_json_detects_laravel(self) -> None:
        content = json.dumps({"require": {"laravel/framework": "^10.0"}})
        result = _detect_frameworks_from_content(
            content, "composer.json", {"laravel/framework": "php-laravel"}
        )
        assert len(result) == 1
        assert result[0]["platform"] == "php-laravel"
        assert result[0]["dep_source"] == "dependencies"

    def test_composer_json_prefix_match_symfony(self) -> None:
        content = json.dumps({"require": {"symfony/framework-bundle": "^6.0"}})
        result = _detect_frameworks_from_content(
            content, "composer.json", {"symfony/": "php-symfony"}
        )
        assert len(result) == 1
        assert result[0]["platform"] == "php-symfony"

    def test_composer_json_dev_dependency(self) -> None:
        content = json.dumps({"require-dev": {"laravel/framework": "^10.0"}})
        result = _detect_frameworks_from_content(
            content, "composer.json", {"laravel/framework": "php-laravel"}
        )
        assert len(result) == 1
        assert result[0]["dep_source"] == "devDependencies"

    def test_go_mod_detects_gin(self) -> None:
        content = "module example.com/myapp\n\nrequire github.com/gin-gonic/gin v1.9.1\n"
        result = _detect_frameworks_from_content(content, "go.mod", {"gin": "go-gin"})
        assert len(result) == 1
        assert result[0]["platform"] == "go-gin"

    def test_build_gradle_detects_spring_boot(self) -> None:
        content = (
            "dependencies {\n    implementation 'org.springframework.boot:spring-boot-starter'\n}\n"
        )
        result = _detect_frameworks_from_content(
            content, "build.gradle", {"spring-boot": "java-spring-boot"}
        )
        assert len(result) == 1
        assert result[0]["platform"] == "java-spring-boot"


def _make_b64_response(content: str) -> dict:
    """Helper to create a GitHub contents API response with base64-encoded content."""
    return {"content": b64encode(content.encode()).decode()}


class TestDetectFramework:
    def test_detects_python_django(self) -> None:
        client = mock.MagicMock()
        client.get.return_value = _make_b64_response("Django==4.2\ncelery>=5.0\n")

        result = detect_framework(client, "owner/repo", "python")

        platforms = [m["platform"] for m in result]
        assert "python-django" in platforms
        assert "python-celery" in platforms

    def test_falls_back_when_manifest_not_found(self) -> None:
        client = mock.MagicMock()
        client.get.side_effect = ApiError("Not Found", code=404)

        result = detect_framework(client, "owner/repo", "python")

        assert result == []

    def test_stops_after_first_manifest_with_results(self) -> None:
        client = mock.MagicMock()
        client.get.return_value = _make_b64_response("Django==4.2\n")

        result = detect_framework(client, "owner/repo", "python")

        assert len(result) == 1
        assert result[0]["platform"] == "python-django"
        # Should have only called get() once (for requirements.txt),
        # not continued to pyproject.toml
        assert client.get.call_count == 1

    def test_tries_next_manifest_when_first_has_no_match(self) -> None:
        client = mock.MagicMock()

        def side_effect(path, params=None):
            if "requirements.txt" in path:
                return _make_b64_response("some-unrelated-package\n")
            if "pyproject.toml" in path:
                return _make_b64_response('[project]\ndependencies = ["flask"]\n')
            raise ApiError("Not Found", code=404)

        client.get.side_effect = side_effect

        result = detect_framework(client, "owner/repo", "python")

        assert len(result) == 1
        assert result[0]["platform"] == "python-flask"

    def test_unknown_platform_returns_empty(self) -> None:
        client = mock.MagicMock()
        result = detect_framework(client, "owner/repo", "unknown-platform")
        assert result == []
        client.get.assert_not_called()

    def test_deduplicates_results(self) -> None:
        client = mock.MagicMock()
        # package.json with both react in deps and devDeps
        content = json.dumps(
            {"dependencies": {"react": "^18.0.0"}, "devDependencies": {"react": "^18.0.0"}}
        )
        client.get.return_value = _make_b64_response(content)

        result = detect_framework(client, "owner/repo", "javascript")

        react_matches = [m for m in result if m["platform"] == "javascript-react"]
        assert len(react_matches) == 1
        # Should prefer prod dep
        assert react_matches[0]["dep_source"] == "dependencies"

    def test_returns_framework_match_objects(self) -> None:
        client = mock.MagicMock()
        content = json.dumps({"dependencies": {"next": "^14.0.0"}})
        client.get.return_value = _make_b64_response(content)

        result = detect_framework(client, "owner/repo", "javascript")

        assert len(result) >= 1
        match = result[0]
        assert "platform" in match
        assert "dep_source" in match


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

        client.get.assert_called_once_with("/repos/owner/repo/contents/", params={"ref": "main"})


class TestDetectFromConfigFiles:
    def test_detects_nextjs_from_config(self) -> None:
        root_files = {"next.config.js", "package.json", "README.md"}
        result = _detect_from_config_files(root_files, "javascript")
        assert "javascript-nextjs" in result

    def test_detects_nuxt_from_config(self) -> None:
        root_files = {"nuxt.config.ts", "package.json"}
        result = _detect_from_config_files(root_files, "javascript")
        assert "javascript-nuxt" in result

    def test_detects_django_from_manage_py(self) -> None:
        root_files = {"manage.py", "requirements.txt"}
        result = _detect_from_config_files(root_files, "python")
        assert "python-django" in result

    def test_detects_laravel_from_artisan(self) -> None:
        root_files = {"artisan", "composer.json"}
        result = _detect_from_config_files(root_files, "php")
        assert "php-laravel" in result

    def test_no_match_returns_empty(self) -> None:
        root_files = {"README.md", "setup.py"}
        result = _detect_from_config_files(root_files, "javascript")
        assert result == []

    def test_unknown_platform_returns_empty(self) -> None:
        root_files = {"next.config.js"}
        result = _detect_from_config_files(root_files, "unknown")
        assert result == []

    def test_deduplicates_multiple_config_variants(self) -> None:
        root_files = {"next.config.js", "next.config.mjs"}
        result = _detect_from_config_files(root_files, "javascript")
        assert result.count("javascript-nextjs") == 1


class TestApplySupersession:
    def test_nextjs_supersedes_react(self) -> None:
        results = [
            DetectedPlatform(
                platform="javascript-nextjs",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=100,
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
                priority=100,
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
                priority=100,
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
                priority=100,
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
        assert result[0]["priority"] == BASE_PLATFORM_PRIORITY

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
        # Python has more bytes but framework detection gives JS higher priority
        client.get_languages.return_value = {"Python": 80000, "JavaScript": 30000}

        def get_side_effect(path, params=None):
            if "requirements.txt" in path:
                return _make_b64_response("flask==3.0\n")
            if "package.json" in path:
                return _make_b64_response(
                    json.dumps({"dependencies": {"next": "^14.0.0", "react": "^18.0.0"}})
                )
            raise ApiError("Not Found", code=404)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        # Next.js (priority 110) > Django (95) > base platforms (10)
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
            if path.endswith("/contents/"):
                return []
            return _make_b64_response(content)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        platforms = [r["platform"] for r in result]
        assert "javascript-nextjs" in platforms
        assert "node-express" in platforms
        assert "javascript-react" not in platforms
        assert "javascript" in platforms

    def test_prod_dep_ranks_higher_than_dev_dep(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"JavaScript": 50000}

        content = json.dumps(
            {
                "dependencies": {"express": "^4.0.0"},
                "devDependencies": {"svelte": "^4.0.0"},
            }
        )

        def get_side_effect(path, params=None):
            if path.endswith("/contents/"):
                return []
            return _make_b64_response(content)

        client.get.side_effect = get_side_effect

        result = detect_platforms(client, "owner/repo")

        express = next(r for r in result if r["platform"] == "node-express")
        svelte = next(r for r in result if r["platform"] == "javascript-svelte")
        # express: priority 60 + 10 (prod) = 70
        # svelte: priority 70 + 0 (dev) = 70
        # Same priority, but express has same bytes, so order may vary.
        # The key thing is both are present and have correct priorities.
        assert express["priority"] == FRAMEWORK_PRIORITY["node-express"] + 10
        assert svelte["priority"] == FRAMEWORK_PRIORITY["javascript-svelte"] + 0

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
            if path.endswith("/contents/"):
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

    def test_config_file_gets_priority_bonus(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"JavaScript": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents/"):
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
        # base priority (100) + config bonus (20) + prod dep bonus (10) = 130
        assert (
            nextjs["priority"] == FRAMEWORK_PRIORITY["javascript-nextjs"] + CONFIG_FILE_BONUS + 10
        )

    def test_config_file_only_gets_config_bonus_without_dep(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"JavaScript": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents/"):
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
        # base priority (100) + config bonus (20) + no dep bonus (0) = 120
        assert nextjs["priority"] == FRAMEWORK_PRIORITY["javascript-nextjs"] + CONFIG_FILE_BONUS

    def test_manage_py_detects_django(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Python": 50000}

        def get_side_effect(path, params=None):
            if path.endswith("/contents/"):
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
        # base priority (90) + config bonus (20) + unknown dep bonus (5) = 115
        assert django["priority"] == FRAMEWORK_PRIORITY["python-django"] + CONFIG_FILE_BONUS + 5
