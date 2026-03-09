from __future__ import annotations

from base64 import b64encode
from unittest import mock

import pytest

from sentry.integrations.github.platform_detection import (
    GITHUB_LANGUAGE_TO_SENTRY_PLATFORM,
    DetectedPlatform,
    _detect_frameworks_from_content,
    _get_repo_file_content,
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
        assert GITHUB_LANGUAGE_TO_SENTRY_PLATFORM.get("Haskell") is None


class TestDetectFrameworksFromContent:
    def test_package_json_detects_next(self) -> None:
        content = json.dumps({"dependencies": {"next": "^14.0.0", "react": "^18.0.0"}})
        result = _detect_frameworks_from_content(
            content, "package.json", {"next": "javascript-nextjs", "react": "javascript-react"}
        )
        assert "javascript-nextjs" in result
        assert "javascript-react" in result

    def test_package_json_checks_dev_dependencies(self) -> None:
        content = json.dumps({"devDependencies": {"svelte": "^4.0.0"}})
        result = _detect_frameworks_from_content(
            content, "package.json", {"svelte": "javascript-svelte"}
        )
        assert result == ["javascript-svelte"]

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
        assert "python-django" in result
        assert "python-celery" in result

    def test_requirements_txt_case_insensitive(self) -> None:
        content = "Flask==3.0\n"
        result = _detect_frameworks_from_content(
            content, "requirements.txt", {"flask": "python-flask"}
        )
        assert result == ["python-flask"]

    def test_gemfile_detects_rails(self) -> None:
        content = 'gem "rails", "~> 7.0"\ngem "pg"\n'
        result = _detect_frameworks_from_content(content, "Gemfile", {"rails": "ruby-rails"})
        assert result == ["ruby-rails"]

    def test_composer_json_detects_laravel(self) -> None:
        content = json.dumps({"require": {"laravel/framework": "^10.0"}})
        result = _detect_frameworks_from_content(
            content, "composer.json", {"laravel/framework": "php-laravel"}
        )
        assert result == ["php-laravel"]

    def test_composer_json_prefix_match_symfony(self) -> None:
        content = json.dumps({"require": {"symfony/framework-bundle": "^6.0"}})
        result = _detect_frameworks_from_content(
            content, "composer.json", {"symfony/": "php-symfony"}
        )
        assert result == ["php-symfony"]

    def test_go_mod_detects_gin(self) -> None:
        content = "module example.com/myapp\n\nrequire github.com/gin-gonic/gin v1.9.1\n"
        result = _detect_frameworks_from_content(content, "go.mod", {"gin": "go-gin"})
        assert result == ["go-gin"]

    def test_build_gradle_detects_spring_boot(self) -> None:
        content = (
            "dependencies {\n    implementation 'org.springframework.boot:spring-boot-starter'\n}\n"
        )
        result = _detect_frameworks_from_content(
            content, "build.gradle", {"spring-boot": "java-spring-boot"}
        )
        assert result == ["java-spring-boot"]


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


class TestDetectFramework:
    def test_detects_python_django(self) -> None:
        client = mock.MagicMock()
        client.get.return_value = _make_b64_response("Django==4.2\ncelery>=5.0\n")

        result = detect_framework(client, "owner/repo", "python")

        assert "python-django" in result
        assert "python-celery" in result

    def test_falls_back_when_manifest_not_found(self) -> None:
        client = mock.MagicMock()
        client.get.side_effect = ApiError("Not Found", code=404)

        result = detect_framework(client, "owner/repo", "python")

        assert result == []

    def test_stops_after_first_manifest_with_results(self) -> None:
        client = mock.MagicMock()
        client.get.return_value = _make_b64_response("Django==4.2\n")

        result = detect_framework(client, "owner/repo", "python")

        assert result == ["python-django"]
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

        assert result == ["python-flask"]

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

        assert result.count("javascript-react") == 1


class TestDetectPlatforms:
    def test_detects_single_language_repo(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Python": 50000}
        client.get.side_effect = ApiError("Not Found", code=404)

        result = detect_platforms(client, "owner/repo")

        assert len(result) == 1
        assert result[0] == DetectedPlatform(
            platform="python",
            language="Python",
            bytes=50000,
            confidence="medium",
        )

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

    def test_preserves_github_ordering(self) -> None:
        client = mock.MagicMock()
        # GitHub returns languages ordered by bytes descending
        client.get_languages.return_value = {"Python": 50000, "Go": 30000, "Ruby": 10000}
        client.get.side_effect = ApiError("Not Found", code=404)

        result = detect_platforms(client, "owner/repo")

        assert result[0]["language"] == "Python"
        assert result[1]["language"] == "Go"
        assert result[2]["language"] == "Ruby"

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

        result = detect_platforms(client, "owner/repo")

        assert result == []

    def test_only_ignored_languages_returns_empty(self) -> None:
        client = mock.MagicMock()
        client.get_languages.return_value = {"Shell": 5000, "Makefile": 1000}

        result = detect_platforms(client, "owner/repo")

        assert result == []

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
