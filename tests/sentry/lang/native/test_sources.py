import copy
from unittest.mock import patch

import jsonschema
import pytest
from django.conf import settings
from django.test import override_settings

from sentry.lang.native.sources import (
    BUILTIN_SOURCE_SCHEMA,
    filter_ignored_sources,
    get_sources_for_project,
)
from sentry.testutils.helpers import Feature, override_options
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_validate_builtin_sources():
    for source in settings.SENTRY_BUILTIN_SOURCES.values():
        jsonschema.validate(source, BUILTIN_SOURCE_SCHEMA)


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
    def test_sources_gcp_bearer_authentication(self, mock_get_gcp_token, default_project):
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
    def test_source_alias(self, mock_get_gcp_token, default_project):
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
    def test_source_with_private_key(self, mock_get_gcp_token, default_project):
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
    def test_mixed_sources(self, mock_get_gcp_token, default_project):
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
    def test_sources_included_and_ignored_empty(self):
        with override_options({"symbolicator.ignored_sources": []}):
            sources = filter_ignored_sources([])

            assert sources == []

    # Default/unset list of sources
    @django_db_all
    def test_sources_ignored_unset(self, sources):
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
    def test_sources_ignored_empty(self, sources):
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
    def test_sources_ignored_builtin(self, sources):
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
    def test_sources_ignored_alias(self, sources, reversed_alias_map):
        with override_options({"symbolicator.ignored_sources": ["sentry:ios"]}):
            sources = filter_ignored_sources(sources, reversed_alias_map)

            source_ids = list(map(lambda s: s["id"], sources))
            assert source_ids == ["sentry:microsoft", "sentry:electron", "custom"]

    @django_db_all
    def test_sources_ignored_bypass_alias(self, sources, reversed_alias_map):
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
    def test_sources_ignored_custom(self, sources):
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
    def test_sources_ignored_unrecognized(self, sources):
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
