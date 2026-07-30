import copy
from unittest import mock

import pytest

from sentry.attachments.base import CachedAttachment
from sentry.lang.native.sources import (
    get_sources_for_project,
    redact_internal_sources,
    reverse_aliases_map,
)
from sentry.lang.native.symbolicator import Symbolicator
from sentry.testutils.helpers import Feature
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json

CUSTOM_SOURCE_CONFIG = """
[{
    "type": "http",
    "id": "custom",
    "layout": {"type": "symstore"},
    "url": "https://msdl.microsoft.com/download/symbols/"
},{
    "type": "appStoreConnect",
    "id": "asc",
    "name": "appconnect-disabled",
    "appconnectIssuer": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "appconnectKey": "foobar",
    "appconnectPrivateKey": "quux",
    "appName": "test",
    "appId": "test",
    "bundleId": "test"
}]
"""


@django_db_all
@pytest.mark.parametrize("enabled", [False, True])
def test_minidump_object_store_extract_variables(default_project, enabled) -> None:
    symbolicator = object.__new__(Symbolicator)
    symbolicator.project = default_project
    symbolicator.event_id = "event-id"

    session = mock.Mock()
    session.mint_token.return_value = "token"
    response = {"status": "completed"}
    attachment = CachedAttachment(stored_id="attachment-id")

    with (
        Feature({"organizations:native-variable-extraction": enabled}),
        mock.patch(
            "sentry.lang.native.symbolicator.sources_for_symbolication",
            return_value=([], lambda result: result),
        ),
        mock.patch("sentry.lang.native.symbolicator.get_scraping_config", return_value={}),
        mock.patch("sentry.lang.native.symbolicator.get_attachments_session", return_value=session),
        mock.patch(
            "sentry.lang.native.symbolicator.get_symbolicator_url", return_value="storage-url"
        ),
        mock.patch.object(symbolicator, "_process", return_value=response) as process,
    ):
        symbolicator.process_minidump("native", attachment, [])

    request = process.call_args.kwargs["kwargs_cb"]()["json"]
    assert request["options"]["extract_variables"] is enabled


@django_db_all
@pytest.mark.parametrize("enabled", [False, True])
def test_minidump_multipart_extract_variables(default_project, enabled) -> None:
    symbolicator = object.__new__(Symbolicator)
    symbolicator.project = default_project
    symbolicator.event_id = "event-id"

    response = {"status": "completed"}
    attachment = CachedAttachment(data=b"minidump")

    with (
        Feature({"organizations:native-variable-extraction": enabled}),
        mock.patch(
            "sentry.lang.native.symbolicator.sources_for_symbolication",
            return_value=([], lambda result: result),
        ),
        mock.patch("sentry.lang.native.symbolicator.get_scraping_config", return_value={}),
        mock.patch.object(symbolicator, "_process", return_value=response) as process,
    ):
        symbolicator.process_minidump("native", attachment, [])

    options = json.loads(process.call_args.kwargs["data"]["options"])
    assert options["extract_variables"] is enabled


@django_db_all
def test_sources_builtin(default_project) -> None:
    features = {"organizations:custom-symbol-sources": False}

    default_project.update_option("sentry:builtin_symbol_sources", ["microsoft"])

    with Feature(features):
        sources = get_sources_for_project(default_project)

    # XXX: The order matters here! Project is always first, then builtin sources
    source_ids = list(map(lambda s: s["id"], sources))
    assert source_ids == ["sentry:project", "sentry:microsoft"]


# Test that a builtin source that is not declared in SENTRY_BUILTIN_SOURCES does
# not lead to an error. It should simply be ignored.
@django_db_all
def test_sources_builtin_unknown(default_project) -> None:
    features = {"organizations:custom-symbol-sources": False}

    default_project.update_option("sentry:builtin_symbol_sources", ["invalid"])

    with Feature(features):
        sources = get_sources_for_project(default_project)

    source_ids = list(map(lambda s: s["id"], sources))
    assert source_ids == ["sentry:project"]


@django_db_all
def test_sources_custom(default_project) -> None:
    features = {"organizations:custom-symbol-sources": True}

    # Remove builtin sources explicitly to avoid defaults
    default_project.update_option("sentry:builtin_symbol_sources", [])
    default_project.update_option("sentry:symbol_sources", CUSTOM_SOURCE_CONFIG)

    with Feature(features):
        sources = get_sources_for_project(default_project)

    # XXX: The order matters here! Project is always first, then custom sources
    # The appStoreConnect source should be filtered out.
    source_ids = list(map(lambda s: s["id"], sources))
    assert source_ids == ["sentry:project", "custom"]


# Test that previously saved custom sources are not returned if the feature for
# custom sources is missing at query time.
@django_db_all
def test_sources_custom_disabled(default_project) -> None:
    features = {"organizations:custom-symbol-sources": False}

    default_project.update_option("sentry:builtin_symbol_sources", [])
    default_project.update_option("sentry:symbol_sources", CUSTOM_SOURCE_CONFIG)

    with Feature(features):
        sources = get_sources_for_project(default_project)

    source_ids = list(map(lambda s: s["id"], sources))
    assert source_ids == ["sentry:project"]


class TestInternalSourcesRedaction:
    def test_custom_untouched(self) -> None:
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

    def test_location_debug_id(self) -> None:
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

    def test_notfound_deduplicated(self) -> None:
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

    def test_notfound_omitted(self) -> None:
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

    def test_multiple_notfound_filtered(self) -> None:
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

    def test_sentry_project(self) -> None:
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

    def test_sentry_project_notfound_no_location(self) -> None:
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

    def test_reverse_aliases(self, builtin_sources) -> None:
        reverse_aliases = reverse_aliases_map(builtin_sources)
        expected = {"sentry:ios-source": "sentry:ios", "sentry:tvos-source": "sentry:ios"}
        assert reverse_aliases == expected
