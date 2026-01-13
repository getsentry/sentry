import copy
from unittest.mock import MagicMock, patch

import jsonschema
import pytest
from django.conf import settings
from django.test import override_settings
from google.auth import exceptions as google_auth_exceptions

from sentry.lang.native.sources import (
    BUILTIN_SOURCE_SCHEMA,
    filter_ignored_sources,
    get_gcp_token,
    get_sources_for_project,
)
from sentry.testutils.helpers import Feature, override_options
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_validate_builtin_sources() -> None:
    for source in settings.SENTRY_BUILTIN_SOURCES.values():
        jsonschema.validate(source, BUILTIN_SOURCE_SCHEMA)


class TestGetGcpToken:
    @patch("sentry.lang.native.sources.google.auth.default")
    @patch("sentry.lang.native.sources.impersonated_credentials.Credentials")
    def test_refresh_error_handling(
        self, mock_credentials_class, mock_google_auth_default
    ) -> None:
        """
        Test that RefreshError from GCP API is caught and handled gracefully.
        """
        # Setup mock credentials
        mock_source_creds = MagicMock()
        mock_google_auth_default.return_value = (mock_source_creds, None)

        # Setup mock target credentials to raise RefreshError
        mock_target_creds = MagicMock()
        mock_target_creds.refresh.side_effect = google_auth_exceptions.RefreshError(
            "Unable to acquire impersonated credentials",
            '{"error": {"code": 503, "message": "Service Unavailable"}}',
        )
        mock_credentials_class.return_value = mock_target_creds

        # Call the function and verify it returns None
        result = get_gcp_token("test@example.iam.gserviceaccount.com")
        assert result is None

    @patch("sentry.lang.native.sources.google.auth.default")
    def test_google_auth_default_failure(self, mock_google_auth_default) -> None:
        """
        Test that exceptions from google.auth.default are caught and handled.
        """
        mock_google_auth_default.side_effect = Exception("Failed to get default credentials")

        result = get_gcp_token("test@example.iam.gserviceaccount.com")
        assert result is None

    @patch("sentry.lang.native.sources.google.auth.default")
    @patch("sentry.lang.native.sources.impersonated_credentials.Credentials")
    def test_successful_token_acquisition(
        self, mock_credentials_class, mock_google_auth_default
    ) -> None:
        """
        Test successful token acquisition.
        """
        # Setup mock credentials
        mock_source_creds = MagicMock()
        mock_google_auth_default.return_value = (mock_source_creds, None)

        # Setup mock target credentials with a valid token
        mock_target_creds = MagicMock()
        mock_target_creds.token = "ya29.test_token"
        mock_target_creds.refresh.return_value = None
        mock_credentials_class.return_value = mock_target_creds

        result = get_gcp_token("test@example.iam.gserviceaccount.com")
        assert result == "ya29.test_token"

    @patch("sentry.lang.native.sources.google.auth.default")
    @patch("sentry.lang.native.sources.impersonated_credentials.Credentials")
    def test_token_is_none_after_refresh(
        self, mock_credentials_class, mock_google_auth_default
    ) -> None:
        """
        Test that None is returned when token is None after refresh.
        """
        # Setup mock credentials
        mock_source_creds = MagicMock()
        mock_google_auth_default.return_value = (mock_source_creds, None)

        # Setup mock target credentials with None token
        mock_target_creds = MagicMock()
        mock_target_creds.token = None
        mock_target_creds.refresh.return_value = None
        mock_credentials_class.return_value = mock_target_creds

        result = get_gcp_token("test@example.iam.gserviceaccount.com")
        assert result is None


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
    def test_sources_gcp_bearer_authentication(self, mock_get_gcp_token, default_project) -> None:
        mock_get_gcp_token.return_value = "ya29.TOKEN"
        features = {
            "organizations:symbol-sources": True,
        }
        default_project.update_option("sentry:builtin_symbol_sources", ["aaa", "bbb"])

        with Feature(features):
            sources = get_sources_for_project(default_project)

        for i in (1, 2):
            assert "client_email" not in sources[i]
            assert "private_key" not in sources[i]
            assert sources[i]["bearer_token"] == "ya29.TOKEN"

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_TEST)
    @patch("sentry.lang.native.sources.get_gcp_token")
    @django_db_all
    def test_source_alias(self, mock_get_gcp_token, default_project) -> None:
        mock_get_gcp_token.return_value = "ya29.TOKEN"
        features = {
            "organizations:symbol-sources": True,
        }
        default_project.update_option("sentry:builtin_symbol_sources", ["ccc"])

        builtin_sources_before = copy.deepcopy(settings.SENTRY_BUILTIN_SOURCES)

        with Feature(features):
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
    def test_source_with_private_key(self, mock_get_gcp_token, default_project) -> None:
        mock_get_gcp_token.return_value = "ya29.TOKEN"
        features = {
            "organizations:symbol-sources": True,
        }
        default_project.update_option("sentry:builtin_symbol_sources", ["ddd"])

        with Feature(features):
            sources = get_sources_for_project(default_project)

        assert sources[1]["name"] == "ddd"
        assert sources[1]["client_email"] == "application@project-id.iam.gserviceaccount.com"
        assert sources[1]["private_key"] == "FAKE_PRIVATE_KEY_STRING"

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_TEST)
    @patch("sentry.lang.native.sources.get_gcp_token")
    @django_db_all
    def test_mixed_sources(self, mock_get_gcp_token, default_project) -> None:
        """
        Tests the combination of sources where one uses credentials for authentication and the other one
        uses pre-fetched token.
        """
        mock_get_gcp_token.return_value = "ya29.TOKEN"
        features = {
            "organizations:symbol-sources": True,
        }
        default_project.update_option("sentry:builtin_symbol_sources", ["eee"])

        with Feature(features):
            sources = get_sources_for_project(default_project)

        assert sources[1]["name"] == "ddd"
        assert "token" not in sources[1]
        assert sources[1]["client_email"] == "application@project-id.iam.gserviceaccount.com"
        assert sources[1]["private_key"] == "FAKE_PRIVATE_KEY_STRING"
        assert sources[2]["name"] == "aaa"
        assert sources[2]["bearer_token"] == "ya29.TOKEN"

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_TEST)
    @patch("sentry.lang.native.sources.get_gcp_token")
    @django_db_all
    def test_gcp_token_failure_graceful_degradation(
        self, mock_get_gcp_token, default_project
    ) -> None:
        """
        Tests that when GCP token acquisition fails, the source is still returned
        without bearer_token, allowing symbolication to continue with other sources.
        """
        mock_get_gcp_token.return_value = None
        features = {
            "organizations:symbol-sources": True,
        }
        default_project.update_option("sentry:builtin_symbol_sources", ["aaa"])

        with Feature(features):
            sources = get_sources_for_project(default_project)

        # Should still have the sentry source and the GCS source
        assert len(sources) == 2
        assert sources[0]["type"] == "sentry"
        assert sources[1]["type"] == "gcs"
        assert sources[1]["name"] == "aaa"
        # The source should still have client_email since token fetch failed
        assert sources[1]["client_email"] == "application@project-id.iam.gserviceaccount.com"
        # But should not have bearer_token
        assert "bearer_token" not in sources[1]


class TestIgnoredSourcesFiltering:
    @pytest.fixture
    def sources(self):
        builtins = [
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
    def reversed_alias_map(self):
        return {"sentry:ios-source": "sentry:ios", "sentry:tvos-source": "sentry:ios"}

    # Explicitly empty list of sources
    @django_db_all
    def test_sources_included_and_ignored_empty(self) -> None:
        with override_options({"symbolicator.ignored_sources": []}):
            sources = filter_ignored_sources([])

            assert sources == []

    # Default/unset list of sources
    @django_db_all
    def test_sources_ignored_unset(self, sources) -> None:
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
    def test_sources_ignored_empty(self, sources) -> None:
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
    def test_sources_ignored_builtin(self, sources) -> None:
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
    def test_sources_ignored_alias(self, sources, reversed_alias_map) -> None:
        with override_options({"symbolicator.ignored_sources": ["sentry:ios"]}):
            sources = filter_ignored_sources(sources, reversed_alias_map)

            source_ids = list(map(lambda s: s["id"], sources))
            assert source_ids == ["sentry:microsoft", "sentry:electron", "custom"]

    @django_db_all
    def test_sources_ignored_bypass_alias(self, sources, reversed_alias_map) -> None:
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
    def test_sources_ignored_custom(self, sources) -> None:
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
    def test_sources_ignored_unrecognized(self, sources) -> None:
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
