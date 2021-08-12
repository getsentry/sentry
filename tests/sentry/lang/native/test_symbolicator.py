import copy

import pytest

from sentry.lang.native import symbolicator
from sentry.lang.native.symbolicator import get_sources_for_project, redact_internal_sources
from sentry.testutils.helpers import Feature

CUSTOM_SOURCE_CONFIG = """
[{
    "type": "http",
    "id": "custom",
    "layout": {"type": "symstore"},
    "url": "https://msdl.microsoft.com/download/symbols/"
}]
"""


@pytest.mark.django_db
def test_sources_no_feature(default_project):
    features = {"organizations:symbol-sources": False, "organizations:custom-symbol-sources": False}

    with Feature(features):
        sources = get_sources_for_project(default_project)

    assert len(sources) == 1
    assert sources[0]["type"] == "sentry"
    assert sources[0]["id"] == "sentry:project"


@pytest.mark.django_db
def test_sources_builtin(default_project):
    features = {"organizations:symbol-sources": True, "organizations:custom-symbol-sources": False}

    default_project.update_option("sentry:builtin_symbol_sources", ["microsoft"])

    with Feature(features):
        sources = get_sources_for_project(default_project)

    # XXX: The order matters here! Project is always first, then builtin sources
    source_ids = list(map(lambda s: s["id"], sources))
    assert source_ids == ["sentry:project", "sentry:microsoft"]


# Test that a builtin source that is not declared in SENTRY_BUILTIN_SOURCES does
# not lead to an error. It should simply be ignored.
@pytest.mark.django_db
def test_sources_builtin_unknown(default_project):
    features = {"organizations:symbol-sources": True, "organizations:custom-symbol-sources": False}

    default_project.update_option("sentry:builtin_symbol_sources", ["invalid"])

    with Feature(features):
        sources = get_sources_for_project(default_project)

    source_ids = list(map(lambda s: s["id"], sources))
    assert source_ids == ["sentry:project"]


# Test that previously saved builtin sources are not returned if the feature for
# builtin sources is missing at query time.
@pytest.mark.django_db
def test_sources_builtin_disabled(default_project):
    features = {"organizations:symbol-sources": False, "organizations:custom-symbol-sources": False}

    default_project.update_option("sentry:builtin_symbol_sources", ["microsoft"])

    with Feature(features):
        sources = get_sources_for_project(default_project)

    source_ids = list(map(lambda s: s["id"], sources))
    assert source_ids == ["sentry:project"]


@pytest.mark.django_db
def test_sources_custom(default_project):
    features = {"organizations:symbol-sources": True, "organizations:custom-symbol-sources": True}

    # Remove builtin sources explicitly to avoid defaults
    default_project.update_option("sentry:builtin_symbol_sources", [])
    default_project.update_option("sentry:symbol_sources", CUSTOM_SOURCE_CONFIG)

    with Feature(features):
        sources = get_sources_for_project(default_project)

    # XXX: The order matters here! Project is always first, then custom sources
    source_ids = list(map(lambda s: s["id"], sources))
    assert source_ids == ["sentry:project", "custom"]


# Test that previously saved custom sources are not returned if the feature for
# custom sources is missing at query time.
@pytest.mark.django_db
def test_sources_custom_disabled(default_project):
    features = {"organizations:symbol-sources": True, "organizations:custom-symbol-sources": False}

    default_project.update_option("sentry:builtin_symbol_sources", [])
    default_project.update_option("sentry:symbol_sources", CUSTOM_SOURCE_CONFIG)

    with Feature(features):
        sources = get_sources_for_project(default_project)

    source_ids = list(map(lambda s: s["id"], sources))
    assert source_ids == ["sentry:project"]


class TestInternalSourcesRedaction:
    def test_custom_untouched(self):
        debug_id = "451a38b5-0679-79d2-0738-22a5ceb24c4b"
        candidates = [
            {
                "source": "custom",
                "location": "http://example.net/prefix/path",
                "download": {"status": "ok"},
            },
        ]
        response = {"modules": [{"debug_id": debug_id, "candidates": copy.copy(candidates)}]}
        redact_internal_sources(response)
        assert response["modules"][0]["candidates"] == candidates

    def test_location_debug_id(self):
        debug_id = "451a38b5-0679-79d2-0738-22a5ceb24c4b"
        candidates = [
            {
                "source": "sentry:microsoft",
                "location": "http://microsoft.com/prefix/path0",
                "download": {"status": "ok"},
            },
        ]
        response = {"modules": [{"debug_id": debug_id, "candidates": copy.copy(candidates)}]}
        redact_internal_sources(response)
        expected = [{"source": "sentry:microsoft", "download": {"status": "ok"}}]
        assert response["modules"][0]["candidates"] == expected

    def test_notfound_deduplicated(self):
        debug_id = "451a38b5-0679-79d2-0738-22a5ceb24c4b"
        candidates = [
            {
                "source": "sentry:microsoft",
                "location": "http://microsoft.com/prefix/path0",
                "download": {"status": "notfound"},
            },
            {
                "source": "sentry:microsoft",
                "location": "http://microsoft.com/prefix/path1",
                "download": {"status": "notfound"},
            },
        ]
        response = {"modules": [{"debug_id": debug_id, "candidates": copy.copy(candidates)}]}
        redact_internal_sources(response)
        expected = [{"source": "sentry:microsoft", "download": {"status": "notfound"}}]
        assert response["modules"][0]["candidates"] == expected

    def test_notfound_omitted(self):
        debug_id = "451a38b5-0679-79d2-0738-22a5ceb24c4b"
        candidates = [
            {
                "source": "sentry:microsoft",
                "location": "http://microsoft.com/prefix/path0",
                "download": {"status": "notfound"},
            },
            {
                "source": "sentry:microsoft",
                "location": "http://microsoft.com/prefix/path1",
                "download": {"status": "ok"},
            },
        ]
        response = {"modules": [{"debug_id": debug_id, "candidates": copy.copy(candidates)}]}
        redact_internal_sources(response)
        expected = [{"source": "sentry:microsoft", "download": {"status": "ok"}}]
        assert response["modules"][0]["candidates"] == expected

    def test_multiple_notfound_filtered(self):
        debug_id = "451a38b5-0679-79d2-0738-22a5ceb24c4b"
        candidates = [
            {
                "source": "sentry:microsoft",
                "location": "http://microsoft.com/prefix/path0",
                "download": {"status": "notfound"},
            },
            {
                "source": "sentry:microsoft",
                "location": "http://microsoft.com/prefix/path1",
                "download": {"status": "ok"},
            },
            {
                "source": "sentry:apple",
                "location": "http://microsoft.com/prefix/path0",
                "download": {"status": "notfound"},
            },
            {
                "source": "sentry:apple",
                "location": "http://microsoft.com/prefix/path1",
                "download": {"status": "ok"},
            },
        ]
        response = {"modules": [{"debug_id": debug_id, "candidates": copy.copy(candidates)}]}
        redact_internal_sources(response)
        expected = [
            {"source": "sentry:microsoft", "download": {"status": "ok"}},
            {"source": "sentry:apple", "download": {"status": "ok"}},
        ]
        assert response["modules"][0]["candidates"] == expected

    def test_sentry_project(self):
        debug_id = "451a38b5-0679-79d2-0738-22a5ceb24c4b"
        candidates = [
            {
                "source": "sentry:project",
                "location": "sentry://project_debug_file/123",
                "download": {"status": "ok"},
            },
        ]
        response = {"modules": [{"debug_id": debug_id, "candidates": copy.copy(candidates)}]}
        redact_internal_sources(response)
        expected = [
            {
                "source": "sentry:project",
                "location": "sentry://project_debug_file/123",
                "download": {"status": "ok"},
            },
        ]
        assert response["modules"][0]["candidates"] == expected

    def test_sentry_project_notfound_no_location(self):
        # For sentry:project status=notfound the location needs to be removed
        debug_id = "451a38b5-0679-79d2-0738-22a5ceb24c4b"
        candidates = [
            {
                "source": "sentry:project",
                "location": "Not the locacation you are looking for",
                "download": {"status": "notfound"},
            },
        ]
        response = {"modules": [{"debug_id": debug_id, "candidates": copy.copy(candidates)}]}
        redact_internal_sources(response)
        expected = [{"source": "sentry:project", "download": {"status": "notfound"}}]
        assert response["modules"][0]["candidates"] == expected


class TestAliasReversion:
    @pytest.fixture
    def builtin_sources(self):
        return {
            "ios": {
                "id": "sentry:ios",
                "name": "Apple",
                "type": "alias",
                "sources": ["ios-source", "tvos-source"],
            },
            "ios-source": {
                "id": "sentry:ios-source",
                "name": "iOS",
                "type": "gcs",
            },
            "tvos-source": {
                "id": "sentry:tvos-source",
                "name": "TvOS",
                "type": "gcs",
            },
        }

    def test_reverse_aliases(self, builtin_sources):
        reverse_aliases = symbolicator.reverse_aliases_map(builtin_sources)
        expected = {"sentry:ios-source": "sentry:ios", "sentry:tvos-source": "sentry:ios"}
        assert reverse_aliases == expected
