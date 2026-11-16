import copy
from collections.abc import Callable
from typing import Any
from unittest.mock import Mock, patch

import jsonschema
import orjson
import pytest
from django.conf import settings
from django.test import override_settings

from sentry.lang.native.sources import (
    BUILTIN_SOURCE_SCHEMA,
    SOURCES_SCHEMA,
    SOURCES_WITHOUT_APPSTORE_CONNECT,
    InvalidSourcesError,
    _sources_validator,
    filter_ignored_sources,
    get_sources_for_project,
    parse_sources,
    validate_sources,
)
from sentry.models.project import Project
from sentry.testutils.helpers import override_options
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_validate_builtin_sources() -> None:
    for source in settings.SENTRY_BUILTIN_SOURCES.values():
        jsonschema.validate(source, BUILTIN_SOURCE_SCHEMA)


HTTP_SOURCE: dict[str, Any] = {
    "id": "custom",
    "type": "http",
    "name": "Custom",
    "url": "https://symbols.example.com/",
    "layout": {"type": "native", "casing": "default"},
}

SOURCES = [
    pytest.param([HTTP_SOURCE], id="valid"),
    pytest.param([{**HTTP_SOURCE, "url": 1}], id="bad-url"),
    pytest.param([{k: v for k, v in HTTP_SOURCE.items() if k != "layout"}], id="no-layout"),
    pytest.param([{**HTTP_SOURCE, "layout": {"type": "unknown"}}], id="bad-layout"),
    pytest.param([{**HTTP_SOURCE, "type": "appStoreConnect"}], id="app-store-connect"),
]


def _validation_error(validate: Callable[[], None]) -> tuple[Any, ...] | None:
    try:
        validate()
    except InvalidSourcesError as e:
        error = e.__context__
        assert isinstance(error, jsonschema.ValidationError)
        return (error.message, list(error.absolute_path), list(error.absolute_schema_path))
    except jsonschema.ValidationError as e:
        return (e.message, list(e.absolute_path), list(e.absolute_schema_path))
    return None


def test_sources_schema_is_valid() -> None:
    jsonschema.validators.validator_for(SOURCES_WITHOUT_APPSTORE_CONNECT).check_schema(
        SOURCES_WITHOUT_APPSTORE_CONNECT
    )


def test_sources_validator_matches_jsonschema_validate() -> None:
    # `Any`: the stubs' `Validator` protocol lacks `format_checker`.
    validator: Any = _sources_validator()
    assert type(validator) is jsonschema.validators.validator_for(SOURCES_WITHOUT_APPSTORE_CONNECT)
    assert validator.schema is SOURCES_WITHOUT_APPSTORE_CONNECT
    assert validator.format_checker is None


@pytest.mark.parametrize("sources", SOURCES)
def test_validate_sources_matches_jsonschema_validate(sources: list[dict[str, Any]]) -> None:
    assert _validation_error(lambda: validate_sources(sources)) == _validation_error(
        lambda: jsonschema.validate(sources, SOURCES_WITHOUT_APPSTORE_CONNECT)
    )


@pytest.mark.parametrize("sources", SOURCES)
def test_validate_sources_with_schema_matches_jsonschema_validate(
    sources: list[dict[str, Any]],
) -> None:
    assert _validation_error(
        lambda: validate_sources(sources, schema=SOURCES_SCHEMA)
    ) == _validation_error(lambda: jsonschema.validate(sources, SOURCES_SCHEMA))


def test_validate_sources_invalid() -> None:
    with pytest.raises(InvalidSourcesError):
        validate_sources([{**HTTP_SOURCE, "url": 1}])


def test_parse_sources_does_not_recheck_schema() -> None:
    config = orjson.dumps([HTTP_SOURCE]).decode()
    assert parse_sources(config, filter_appconnect=True) == [HTTP_SOURCE]

    with patch.object(type(_sources_validator()), "check_schema") as check_schema:
        for _ in range(3):
            assert parse_sources(config, filter_appconnect=True) == [HTTP_SOURCE]

    check_schema.assert_not_called()


SENTRY_BUILTIN_SOURCES_TEST = {
    "aaa": {
        "id": "sentry:builtin-aaa",
        "name": "aaa",
        "type": "gcs",
        "client_email": "application@project-id.iam.gserviceaccount.com",
    },
    "bbb": {
        "id": "sentry:builtin-bbb",
        "name": "bbb",
        "type": "gcs",
        "client_email": "application@project-id.iam.gserviceaccount.com",
    },
    "ccc": {"id": "sentry:builtin-ccc", "name": "ccc", "type": "alias", "sources": ["aaa", "bbb"]},
    "ddd": {
        "id": "sentry:builtin-ddd",
        "name": "ddd",
        "type": "gcs",
        "client_email": "application@project-id.iam.gserviceaccount.com",
        "private_key": "FAKE_PRIVATE_KEY_STRING",
    },
    "eee": {"id": "sentry:builtin-eee", "name": "eee", "type": "alias", "sources": ["ddd", "aaa"]},
}


class TestGcpBearerAuthentication:
    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_TEST)
    @patch("sentry.lang.native.sources.get_gcp_token")
    @django_db_all
    def test_sources_gcp_bearer_authentication(
        self, mock_get_gcp_token: Mock, default_project: Project
    ) -> None:
        mock_get_gcp_token.return_value = "ya29.TOKEN"
        default_project.update_option("sentry:builtin_symbol_sources", ["aaa", "bbb"])

        sources = get_sources_for_project(default_project)

        for i in (1, 2):
            assert "client_email" not in sources[i]
            assert "private_key" not in sources[i]
            assert sources[i]["bearer_token"] == "ya29.TOKEN"

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_TEST)
    @patch("sentry.lang.native.sources.get_gcp_token")
    @django_db_all
    def test_source_alias(self, mock_get_gcp_token: Mock, default_project: Project) -> None:
        mock_get_gcp_token.return_value = "ya29.TOKEN"
        default_project.update_option("sentry:builtin_symbol_sources", ["ccc"])

        builtin_sources_before = copy.deepcopy(settings.SENTRY_BUILTIN_SOURCES)

        sources = get_sources_for_project(default_project)

        assert builtin_sources_before == copy.deepcopy(settings.SENTRY_BUILTIN_SOURCES)

        # Make sure that we expanded successfully here
        # Source 1 will be sentry, the following 2 will be the expanded gcs sources
        assert len(sources) == 3
        assert sources[0]["type"] == "sentry"
        assert sources[1]["type"] == "gcs"
        assert sources[1]["name"] == "aaa"
        assert sources[2]["type"] == "gcs"
        assert sources[2]["name"] == "bbb"
        for i in (1, 2):
            assert "client_email" not in sources[i]
            assert "private_key" not in sources[i]
            assert sources[i]["bearer_token"] == "ya29.TOKEN"

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_TEST)
    @patch("sentry.lang.native.sources.get_gcp_token")
    @django_db_all
    def test_source_with_private_key(
        self, mock_get_gcp_token: Mock, default_project: Project
    ) -> None:
        mock_get_gcp_token.return_value = "ya29.TOKEN"
        default_project.update_option("sentry:builtin_symbol_sources", ["ddd"])

        sources = get_sources_for_project(default_project)

        assert sources[1]["name"] == "ddd"
        assert sources[1]["client_email"] == "application@project-id.iam.gserviceaccount.com"
        assert sources[1]["private_key"] == "FAKE_PRIVATE_KEY_STRING"

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_TEST)
    @patch("sentry.lang.native.sources.get_gcp_token")
    @django_db_all
    def test_mixed_sources(self, mock_get_gcp_token: Mock, default_project: Project) -> None:
        """
        Tests the combination of sources where one uses credentials for authentication and the other one
        uses pre-fetched token.
        """
        mock_get_gcp_token.return_value = "ya29.TOKEN"
        default_project.update_option("sentry:builtin_symbol_sources", ["eee"])

        sources = get_sources_for_project(default_project)

        assert sources[1]["name"] == "ddd"
        assert "token" not in sources[1]
        assert sources[1]["client_email"] == "application@project-id.iam.gserviceaccount.com"
        assert sources[1]["private_key"] == "FAKE_PRIVATE_KEY_STRING"
        assert sources[2]["name"] == "aaa"
        assert sources[2]["bearer_token"] == "ya29.TOKEN"


class TestIgnoredSourcesFiltering:
    @pytest.fixture
    def sources(self) -> list[dict[str, object]]:
        builtins: list[dict[str, object]] = [
            {
                "id": "sentry:microsoft",
                "name": "Microsoft",
                "type": "gcs",
            },
            {
                "id": "sentry:electron",
                "name": "Electron",
                "type": "s3",
            },
            {
                "id": "sentry:ios-source",
                "name": "iOS",
                "type": "http",
            },
            {
                "id": "sentry:tvos-source",
                "name": "iOS",
                "type": "http",
            },
            {
                "type": "http",
                "id": "custom",
                "layout": {"type": "symstore"},
                "url": "https://msdl.microsoft.com/download/symbols/",
            },
        ]
        return builtins

    @pytest.fixture
    def reversed_alias_map(self) -> dict[str, str]:
        return {"sentry:ios-source": "sentry:ios", "sentry:tvos-source": "sentry:ios"}

    # Explicitly empty list of sources
    @django_db_all
    def test_sources_included_and_ignored_empty(self) -> None:
        with override_options({"symbolicator.ignored_sources": []}):
            sources = filter_ignored_sources([])

            assert sources == []

    # Default/unset list of sources
    @django_db_all
    def test_sources_ignored_unset(self, sources: list[dict[str, object]]) -> None:
        sources = filter_ignored_sources(sources)

        source_ids = list(map(lambda s: s["id"], sources))
        assert source_ids == [
            "sentry:microsoft",
            "sentry:electron",
            "sentry:ios-source",
            "sentry:tvos-source",
            "custom",
        ]

    @django_db_all
    def test_sources_ignored_empty(self, sources: list[dict[str, object]]) -> None:
        with override_options({"symbolicator.ignored_sources": []}):
            sources = filter_ignored_sources(sources)

            source_ids = list(map(lambda s: s["id"], sources))
            assert source_ids == [
                "sentry:microsoft",
                "sentry:electron",
                "sentry:ios-source",
                "sentry:tvos-source",
                "custom",
            ]

    @django_db_all
    def test_sources_ignored_builtin(self, sources: list[dict[str, object]]) -> None:
        with override_options({"symbolicator.ignored_sources": ["sentry:microsoft"]}):
            sources = filter_ignored_sources(sources)

            source_ids = list(map(lambda s: s["id"], sources))
            assert source_ids == [
                "sentry:electron",
                "sentry:ios-source",
                "sentry:tvos-source",
                "custom",
            ]

    @django_db_all
    def test_sources_ignored_alias(
        self, sources: list[dict[str, object]], reversed_alias_map: dict[str, str]
    ) -> None:
        with override_options({"symbolicator.ignored_sources": ["sentry:ios"]}):
            sources = filter_ignored_sources(sources, reversed_alias_map)

            source_ids = list(map(lambda s: s["id"], sources))
            assert source_ids == ["sentry:microsoft", "sentry:electron", "custom"]

    @django_db_all
    def test_sources_ignored_bypass_alias(
        self, sources: list[dict[str, object]], reversed_alias_map: dict[str, str]
    ) -> None:
        with override_options({"symbolicator.ignored_sources": ["sentry:ios-source"]}):
            sources = filter_ignored_sources(sources, reversed_alias_map)

            source_ids = list(map(lambda s: s["id"], sources))
            assert source_ids == [
                "sentry:microsoft",
                "sentry:electron",
                "sentry:tvos-source",
                "custom",
            ]

    @django_db_all
    def test_sources_ignored_custom(self, sources: list[dict[str, object]]) -> None:
        with override_options({"symbolicator.ignored_sources": ["custom"]}):
            sources = filter_ignored_sources(sources)

            source_ids = list(map(lambda s: s["id"], sources))
            assert source_ids == [
                "sentry:microsoft",
                "sentry:electron",
                "sentry:ios-source",
                "sentry:tvos-source",
            ]

    @django_db_all
    def test_sources_ignored_unrecognized(self, sources: list[dict[str, object]]) -> None:
        with override_options({"symbolicator.ignored_sources": ["honk"]}):
            sources = filter_ignored_sources(sources)

            source_ids = list(map(lambda s: s["id"], sources))
            assert source_ids == [
                "sentry:microsoft",
                "sentry:electron",
                "sentry:ios-source",
                "sentry:tvos-source",
                "custom",
            ]
