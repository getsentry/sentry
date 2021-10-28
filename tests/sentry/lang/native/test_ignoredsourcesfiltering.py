import pytest

from sentry.lang.native.symbolicator import filter_ignored_sources
from sentry.testutils.helpers import override_options


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
    @pytest.mark.django_db
    def test_sources_included_and_ignored_empty(self):
        with override_options({"symbolicator.ignored_sources": []}):
            sources = filter_ignored_sources([])

            assert sources == []

    # Default/unset list of sources
    @pytest.mark.django_db
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

    @pytest.mark.django_db
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

    @pytest.mark.django_db
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

    @pytest.mark.django_db
    def test_sources_ignored_alias(self, sources, reversed_alias_map):
        with override_options({"symbolicator.ignored_sources": ["sentry:ios"]}):
            sources = filter_ignored_sources(sources, reversed_alias_map)

            source_ids = list(map(lambda s: s["id"], sources))
            assert source_ids == ["sentry:microsoft", "sentry:electron", "custom"]

    @pytest.mark.django_db
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

    @pytest.mark.django_db
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

    @pytest.mark.django_db
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
