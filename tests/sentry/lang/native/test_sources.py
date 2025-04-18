import jsonschema
import pytest
from django.conf import settings

from sentry.lang.native.sources import BUILTIN_SOURCE_SCHEMA, filter_ignored_sources
from sentry.testutils.helpers import override_options
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_validate_builtin_sources():
    for source in settings.SENTRY_BUILTIN_SOURCES.values():
        jsonschema.validate(source, BUILTIN_SOURCE_SCHEMA)


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
