import errno
import re
import unittest
import zipfile
from copy import deepcopy
from io import BytesIO
from unittest.mock import ANY, MagicMock, call, patch

import pytest
import responses
from requests.exceptions import RequestException

from sentry import http, options
from sentry.event_manager import get_tag
from sentry.lang.javascript.errormapping import REACT_MAPPING_URL, rewrite_exception
from sentry.lang.javascript.processor import (
    CACHE_CONTROL_MAX,
    CACHE_CONTROL_MIN,
    JavaScriptStacktraceProcessor,
    UnparseableSourcemap,
    cache,
    discover_sourcemap,
    fetch_file,
    fetch_release_archive_for_url,
    fetch_release_file,
    fetch_sourcemap,
    generate_module,
    get_function_for_token,
    get_max_age,
    get_release_file_cache_key,
    get_release_file_cache_key_meta,
    should_retry_fetch,
    trim_line,
)
from sentry.models import EventError, File, Release, ReleaseFile
from sentry.models.releasefile import ARTIFACT_INDEX_FILENAME, update_artifact_index
from sentry.stacktraces.processing import ProcessableFrame, find_stacktraces_in_data
from sentry.testutils import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.utils import json
from sentry.utils.strings import truncatechars

base64_sourcemap = "data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvdGVzdC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zb2xlLmxvZyhcImhlbGxvLCBXb3JsZCFcIikiXX0="

unicode_body = b"""function add(a, b) {
    "use strict";
    return a + b; // f\xc3\xb4o
}""".decode(
    "utf-8"
)


class JavaScriptStacktraceProcessorTest(TestCase):
    def test_infers_allow_scraping(self):
        project = self.create_project()
        r = JavaScriptStacktraceProcessor({}, None, project)
        # defaults
        assert r.allow_scraping

        # disabled for project
        project.update_option("sentry:scrape_javascript", False)
        r = JavaScriptStacktraceProcessor({}, None, project)
        assert not r.allow_scraping

        # disabled for org
        project.delete_option("sentry:scrape_javascript")
        project.organization.update_option("sentry:scrape_javascript", False)
        r = JavaScriptStacktraceProcessor({}, None, project)
        assert not r.allow_scraping

    @patch(
        "sentry.lang.javascript.processor.JavaScriptStacktraceProcessor.get_valid_frames",
        return_value=[1],
    )
    @patch(
        "sentry.lang.javascript.processor.JavaScriptStacktraceProcessor.populate_source_cache",
    )
    def test_missing_dist(self, _1, _2):
        """preprocess will create a dist object on-demand"""
        project = self.create_project()
        release = self.create_release(project=project, version="12.31.12")

        processor = JavaScriptStacktraceProcessor(
            data={"release": release.version, "dist": "foo", "timestamp": 123.4},
            stacktrace_infos=[],
            project=project,
        )

        assert processor.release is None
        assert processor.dist is None

        processor.preprocess_step(None)

        assert processor.release == release
        assert processor.dist is not None
        assert processor.dist.name == "foo"
        assert processor.dist.date_added.timestamp() == processor.data["timestamp"]

    @with_feature("organizations:javascript-console-error-tag")
    def test_tag_suspected_console_error(self):
        project = self.create_project()
        release = self.create_release(project=project, version="12.31.12")

        data = {
            "is_exception": True,
            "platform": "javascript",
            "project": project.id,
            "exception": {
                "values": [
                    {
                        "type": "SyntaxError",
                        "mechanism": {
                            "type": "onerror",
                        },
                        "value": ("value"),
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "http://example.com/foo.js",
                                    "filename": "<anonymous>",
                                    "function": "?",
                                    "lineno": 4,
                                    "colno": 0,
                                },
                            ]
                        },
                    }
                ]
            },
        }

        stacktrace_infos = [
            stacktrace for stacktrace in find_stacktraces_in_data(data, with_exceptions=True)
        ]
        processor = JavaScriptStacktraceProcessor(
            data={"release": release.version, "dist": "foo", "timestamp": 123.4},
            project=project,
            stacktrace_infos=stacktrace_infos,
        )

        frames = processor.get_valid_frames()
        assert processor.suspected_console_errors(frames) is True

        processor.tag_suspected_console_errors(frames)
        assert get_tag(processor.data, "empty_stacktrace.js_console") is True

    @with_feature("organizations:javascript-console-error-tag")
    def test_no_suspected_console_error(self):
        project = self.create_project()
        release = self.create_release(project=project, version="12.31.12")

        data = {
            "is_exception": True,
            "platform": "javascript",
            "project": project.id,
            "exception": {
                "values": [
                    {
                        "type": "SyntaxError",
                        "mechanism": {
                            "type": "onerror",
                        },
                        "value": ("value"),
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "http://example.com/foo.js",
                                    "filename": "<anonymous>",
                                    "function": "name",
                                    "lineno": 4,
                                    "colno": 0,
                                },
                                {
                                    "abs_path": "http://example.com/foo.js",
                                    "filename": "<anonymous>",
                                    "function": "new name",
                                    "lineno": 4,
                                    "colno": 0,
                                },
                            ]
                        },
                    }
                ]
            },
        }

        stacktrace_infos = [
            stacktrace for stacktrace in find_stacktraces_in_data(data, with_exceptions=True)
        ]

        processor = JavaScriptStacktraceProcessor(
            data={"release": release.version, "dist": "foo", "timestamp": 123.4},
            project=project,
            stacktrace_infos=stacktrace_infos,
        )

        frames = processor.get_valid_frames()
        assert processor.suspected_console_errors(frames) is False

        processor.tag_suspected_console_errors(frames)
        assert get_tag(processor.data, "empty_stacktrace.js_console") is False


def test_build_fetch_retry_condition() -> None:
    e = OSError()
    e.errno = errno.ESTALE

    assert should_retry_fetch(1, e) is True
    assert should_retry_fetch(2, e) is True
    assert should_retry_fetch(3, e) is True
    assert should_retry_fetch(4, e) is False

    assert should_retry_fetch(1, Exception("something else")) is False


class FetchReleaseFileTest(TestCase):
    def test_unicode(self):
        project = self.project
        release = Release.objects.create(organization_id=project.organization_id, version="abc")
        release.add_project(project)

        file = File.objects.create(
            name="file.min.js",
            type="release.file",
            headers={"Content-Type": "application/json; charset=utf-8"},
        )

        binary_body = unicode_body.encode("utf-8")
        file.putfile(BytesIO(binary_body))

        ReleaseFile.objects.create(
            name="file.min.js",
            release_id=release.id,
            organization_id=project.organization_id,
            file=file,
        )

        result = fetch_release_file("file.min.js", release)

        assert isinstance(result.body, bytes)
        assert result == http.UrlResult(
            "file.min.js",
            {"content-type": "application/json; charset=utf-8"},
            binary_body,
            200,
            "utf-8",
        )

        # looking again should hit the cache - make sure it's come through the
        # caching/uncaching process unscathed
        new_result = fetch_release_file("file.min.js", release)
        assert result == new_result

    def test_distribution(self):
        project = self.project
        release = Release.objects.create(organization_id=project.organization_id, version="abc")
        release.add_project(project)

        foo_file = File.objects.create(
            name="file.min.js",
            type="release.file",
            headers={"Content-Type": "application/json; charset=utf-8"},
        )
        foo_file.putfile(BytesIO(b"foo"))
        foo_dist = release.add_dist("foo")
        ReleaseFile.objects.create(
            name="file.min.js",
            release_id=release.id,
            dist_id=foo_dist.id,
            organization_id=project.organization_id,
            file=foo_file,
        )

        bar_file = File.objects.create(
            name="file.min.js",
            type="release.file",
            headers={"Content-Type": "application/json; charset=utf-8"},
        )
        bar_file.putfile(BytesIO(b"bar"))
        bar_dist = release.add_dist("bar")
        ReleaseFile.objects.create(
            name="file.min.js",
            release_id=release.id,
            dist_id=bar_dist.id,
            organization_id=project.organization_id,
            file=bar_file,
        )

        foo_result = fetch_release_file("file.min.js", release, foo_dist)

        assert isinstance(foo_result.body, bytes)
        assert foo_result == http.UrlResult(
            "file.min.js", {"content-type": "application/json; charset=utf-8"}, b"foo", 200, "utf-8"
        )

        # test that cache pays attention to dist value as well as name
        bar_result = fetch_release_file("file.min.js", release, bar_dist)

        # result is cached, but that's not what we should find
        assert bar_result != foo_result
        assert bar_result == http.UrlResult(
            "file.min.js", {"content-type": "application/json; charset=utf-8"}, b"bar", 200, "utf-8"
        )

    def test_tilde(self):
        project = self.project
        release = Release.objects.create(organization_id=project.organization_id, version="abc")
        release.add_project(project)

        file = File.objects.create(
            name="~/file.min.js",
            type="release.file",
            headers={"Content-Type": "application/json; charset=utf-8"},
        )

        binary_body = unicode_body.encode("utf-8")
        file.putfile(BytesIO(binary_body))

        ReleaseFile.objects.create(
            name="~/file.min.js",
            release_id=release.id,
            organization_id=project.organization_id,
            file=file,
        )

        result = fetch_release_file("http://example.com/file.min.js?lol", release)

        assert isinstance(result.body, bytes)
        assert result == http.UrlResult(
            "http://example.com/file.min.js?lol",
            {"content-type": "application/json; charset=utf-8"},
            binary_body,
            200,
            "utf-8",
        )

    def test_caching(self):
        # Set the threshold to zero to force caching on the file system
        options.set("releasefile.cache-limit", 0)

        project = self.project
        release = Release.objects.create(organization_id=project.organization_id, version="abc")
        release.add_project(project)

        file = File.objects.create(
            name="file.min.js",
            type="release.file",
            headers={"Content-Type": "application/json; charset=utf-8"},
        )

        binary_body = unicode_body.encode("utf-8")
        file.putfile(BytesIO(binary_body))

        ReleaseFile.objects.create(
            name="file.min.js",
            release_id=release.id,
            organization_id=project.organization_id,
            file=file,
        )

        result = fetch_release_file("file.min.js", release)

        assert isinstance(result.body, bytes)
        assert result == http.UrlResult(
            "file.min.js",
            {"content-type": "application/json; charset=utf-8"},
            binary_body,
            200,
            "utf-8",
        )

        # test with cache hit, coming from the FS
        new_result = fetch_release_file("file.min.js", release)

        assert result == new_result

    @patch("sentry.lang.javascript.processor.compress_file")
    def test_compression(self, mock_compress_file):
        """
        For files larger than max memcached payload size we want to avoid
        pointless compression and  caching attempt since it fails silently.

        Tests scenarios:

        - happy path where compressed file is successfully cached
        - compressed payload is too large to cache and we will avoid
          compression and caching while the metadata cache exists

        """
        project = self.project
        release = Release.objects.create(organization_id=project.organization_id, version="abc")
        release.add_project(project)

        filename = "file.min.js"
        file = File.objects.create(
            name=filename,
            type="release.file",
            headers={"Content-Type": "application/json; charset=utf-8"},
        )

        binary_body = unicode_body.encode("utf-8")
        file.putfile(BytesIO(binary_body))

        ReleaseFile.objects.create(
            name="file.min.js",
            release_id=release.id,
            organization_id=project.organization_id,
            file=file,
        )

        mock_compress_file.return_value = (binary_body, binary_body)

        releasefile_ident = ReleaseFile.get_ident(filename, None)
        cache_key = get_release_file_cache_key(
            release_id=release.id, releasefile_ident=releasefile_ident
        )
        cache_key_meta = get_release_file_cache_key_meta(
            release_id=release.id, releasefile_ident=releasefile_ident
        )

        fetch_release_file(filename, release)

        # Here the ANY is File() retrieved from cache/db
        assert mock_compress_file.mock_calls == [call(ANY)]
        assert cache.get(cache_key_meta)["compressed_size"] == len(binary_body)
        assert cache.get(cache_key)

        # Remove cache and check that calling fetch_release_file will do the
        # compression and caching again

        cache.set(cache_key, None)
        mock_compress_file.reset_mock()

        fetch_release_file(filename, release)

        assert mock_compress_file.mock_calls == [call(ANY)]
        assert cache.get(cache_key_meta)["compressed_size"] == len(binary_body)
        assert cache.get(cache_key)

        # If the file is bigger than the max cache value threshold, avoid
        # compression and caching
        cache.set(cache_key, None)
        mock_compress_file.reset_mock()
        with patch("sentry.lang.javascript.processor.CACHE_MAX_VALUE_SIZE", len(binary_body) - 1):
            result = fetch_release_file(filename, release)

        assert result == http.UrlResult(
            filename,
            {"content-type": "application/json; charset=utf-8"},
            binary_body,
            200,
            "utf-8",
        )

        assert mock_compress_file.mock_calls == []
        assert cache.get(cache_key_meta)["compressed_size"] == len(binary_body)
        assert cache.get(cache_key) is None

        # If the file is bigger than the max cache value threshold, but the
        # metadata cache is empty as well, compress and attempt to cache anyway
        cache.set(cache_key, None)
        cache.set(cache_key_meta, None)
        mock_compress_file.reset_mock()
        with patch("sentry.lang.javascript.processor.CACHE_MAX_VALUE_SIZE", len(binary_body) - 1):
            result = fetch_release_file(filename, release)

        assert result == http.UrlResult(
            filename,
            {"content-type": "application/json; charset=utf-8"},
            binary_body,
            200,
            "utf-8",
        )

        assert mock_compress_file.mock_calls == [call(ANY)]
        assert cache.get(cache_key_meta)["compressed_size"] == len(binary_body)
        assert cache.get(cache_key)

        # If the file is smaller than the max cache value threshold, but the
        # cache is empty, compress and cache
        cache.set(cache_key, None)
        mock_compress_file.reset_mock()
        with patch("sentry.lang.javascript.processor.CACHE_MAX_VALUE_SIZE", len(binary_body) + 1):
            result = fetch_release_file(filename, release)

        assert result == http.UrlResult(
            filename,
            {"content-type": "application/json; charset=utf-8"},
            binary_body,
            200,
            "utf-8",
        )

        assert mock_compress_file.mock_calls == [call(ANY)]
        assert cache.get(cache_key_meta)["compressed_size"] == len(binary_body)
        assert cache.get(cache_key)

    def test_retry_file_open(self) -> None:
        project = self.project

        release = Release.objects.create(organization_id=project.organization_id, version="abc")
        release.add_project(project)

        content = b"foo"

        file = File.objects.create(
            name="file.min.js",
            type="release.file",
            headers={"Content-Type": "application/json; charset=utf-8"},
        )
        file.putfile(BytesIO(content))

        ReleaseFile.objects.create(
            name=file.name,
            release_id=release.id,
            organization_id=project.organization_id,
            file=file,
        )

        stale_file_error = OSError()
        stale_file_error.errno = errno.ESTALE

        bad_file = MagicMock()
        bad_file.chunks.side_effect = stale_file_error

        bad_file_reader = MagicMock()
        bad_file_reader.__enter__.return_value = bad_file

        good_file = MagicMock()
        good_file.chunks.return_value = iter([content])

        good_file_reader = MagicMock()
        good_file_reader.__enter__.return_value = good_file

        with patch("sentry.lang.javascript.processor.ReleaseFile.cache") as cache:
            cache.getfile.side_effect = [bad_file_reader, good_file_reader]

            assert fetch_release_file(file.name, release) == http.UrlResult(
                file.name,
                {k.lower(): v.lower() for k, v in file.headers.items()},
                content,
                200,
                "utf-8",
            )

        assert bad_file.chunks.call_count == 1
        assert good_file.chunks.call_count == 1


class FetchFileTest(TestCase):
    @responses.activate
    def test_simple(self):
        responses.add(
            responses.GET, "http://example.com", body="foo bar", content_type="application/json"
        )

        result = fetch_file("http://example.com")

        assert len(responses.calls) == 1

        assert result.url == "http://example.com"
        assert result.body == b"foo bar"
        assert result.headers == {"content-type": "application/json"}

        # ensure we use the cached result
        result2 = fetch_file("http://example.com")

        assert len(responses.calls) == 1

        assert result == result2

    @responses.activate
    def test_with_token(self):
        responses.add(
            responses.GET,
            re.compile(r"http://example.com/\d+/"),
            body="foo bar",
            content_type="application/json",
        )

        self.project.update_option("sentry:token", "foobar")
        self.project.update_option("sentry:origins", ["*"])

        default_header_name = "X-Sentry-Token"
        header_pairs = [
            (None, default_header_name),
            ("", default_header_name),
            ("X-Custom-Token-Header", "X-Custom-Token-Header"),
        ]

        for i, (header_name_option_value, expected_request_header_name) in enumerate(header_pairs):
            self.project.update_option("sentry:token_header", header_name_option_value)

            url = f"http://example.com/{i}/"
            result = fetch_file(url, project=self.project)

            assert result.url == url
            assert result.body == b"foo bar"
            assert result.headers == {"content-type": "application/json"}

            assert len(responses.calls) == i + 1
            assert responses.calls[i].request.headers[expected_request_header_name] == "foobar"

    @responses.activate
    def test_connection_failure(self):
        responses.add(responses.GET, "http://example.com", body=RequestException())

        with pytest.raises(http.BadSource):
            fetch_file("http://example.com")

        assert len(responses.calls) == 1

        # ensure we use the cached domain-wide failure for the second call
        with pytest.raises(http.BadSource):
            fetch_file("http://example.com/foo/bar")

        assert len(responses.calls) == 1

    @responses.activate
    def test_non_url_without_release(self):
        with pytest.raises(http.BadSource):
            fetch_file("/example.js")

    @responses.activate
    @patch("sentry.lang.javascript.processor.fetch_release_file")
    def test_non_url_with_release(self, mock_fetch_release_file):

        mock_fetch_release_file.return_value = http.UrlResult(
            "/example.js", {"content-type": "application/json"}, b"foo", 200, None
        )

        release = Release.objects.create(version="1", organization_id=self.project.organization_id)
        release.add_project(self.project)

        result = fetch_file("/example.js", release=release)
        assert result.url == "/example.js"
        assert result.body == b"foo"
        assert isinstance(result.body, bytes)
        assert result.headers == {"content-type": "application/json"}
        assert result.encoding is None

    @responses.activate
    def test_non_url_with_release_archive(self):
        compressed = BytesIO()
        with zipfile.ZipFile(compressed, mode="w") as zip_file:
            zip_file.writestr("example.js", b"foo")
            zip_file.writestr(
                "manifest.json",
                json.dumps(
                    {
                        "files": {
                            "example.js": {
                                "url": "/example.js",
                                "headers": {"content-type": "application/json"},
                            }
                        }
                    }
                ),
            )

        release = Release.objects.create(version="1", organization_id=self.project.organization_id)
        release.add_project(self.project)

        compressed.seek(0)
        file_ = File.objects.create(name="foo", type="release.bundle")
        file_.putfile(compressed)
        update_artifact_index(release, None, file_)

        # Attempt to fetch nonexisting
        with pytest.raises(http.BadSource):
            fetch_file("does-not-exist.js", release=release)

        # Attempt to fetch nonexsting again (to check if cache works)
        with pytest.raises(http.BadSource):
            result = fetch_file("does-not-exist.js", release=release)

        result = fetch_file("/example.js", release=release)
        assert result.url == "/example.js"
        assert result.body == b"foo"
        assert isinstance(result.body, bytes)
        assert result.headers == {"content-type": "application/json"}
        assert result.encoding == "utf-8"

        # Make sure cache loading works:
        result2 = fetch_file("/example.js", release=release)
        assert result2 == result

    def _create_archive(self, release, url):
        pseudo_archive = File.objects.create(name="", type="release.bundle")
        pseudo_archive.putfile(BytesIO(b"0123456789"))
        releasefile = ReleaseFile.objects.create(
            name=pseudo_archive.name,
            release_id=release.id,
            organization_id=self.organization.id,
            dist_id=None,
            file=pseudo_archive,
        )
        file = File.objects.create(name=ARTIFACT_INDEX_FILENAME, type="release.artifact-index")
        file.putfile(
            BytesIO(json.dumps({"files": {url: {"archive_ident": releasefile.ident}}}).encode())
        )
        ReleaseFile.objects.create(
            name=ARTIFACT_INDEX_FILENAME,
            release_id=release.id,
            organization_id=self.project.organization_id,
            file=file,
        )

    @patch("sentry.lang.javascript.processor.cache.set", side_effect=cache.set)
    @patch("sentry.lang.javascript.processor.cache.get", side_effect=cache.get)
    def test_archive_caching(self, cache_get, cache_set):
        release = Release.objects.create(version="1", organization_id=self.project.organization_id)

        def relevant_calls(mock, prefix):
            return [
                call
                for call in mock.mock_calls
                if (
                    call.args and call.args[0] or call.kwargs and call.kwargs["key"] or ""
                ).startswith(prefix)
            ]

        # No archive exists:
        result = fetch_release_archive_for_url(release, dist=None, url="foo")
        assert result is None
        assert len(relevant_calls(cache_get, "artifact-index")) == 1
        assert len(relevant_calls(cache_set, "artifact-index")) == 1
        assert len(relevant_calls(cache_get, "releasefile")) == 0
        assert len(relevant_calls(cache_set, "releasefile")) == 0
        cache_get.reset_mock()
        cache_set.reset_mock()

        # Still no archive, cache is only read
        result = fetch_release_archive_for_url(release, dist=None, url="foo")
        assert result is None
        assert len(relevant_calls(cache_get, "artifact-index")) == 1
        assert len(relevant_calls(cache_set, "artifact-index")) == 0
        assert len(relevant_calls(cache_get, "releasefile")) == 0
        assert len(relevant_calls(cache_set, "releasefile")) == 0
        cache_get.reset_mock()
        cache_set.reset_mock()

        # With existing release file:
        release2 = Release.objects.create(version="2", organization_id=self.project.organization_id)
        self._create_archive(release2, "foo")

        # No we have one, call set again
        result = fetch_release_archive_for_url(release2, dist=None, url="foo")
        assert result is not None
        result.close()
        assert len(relevant_calls(cache_get, "artifact-index")) == 1
        assert len(relevant_calls(cache_set, "artifact-index")) == 1
        assert len(relevant_calls(cache_get, "releasefile")) == 1
        assert len(relevant_calls(cache_set, "releasefile")) == 1
        cache_get.reset_mock()
        cache_set.reset_mock()

        # Second time, get it from cache
        result = fetch_release_archive_for_url(release2, dist=None, url="foo")
        assert result is not None
        result.close()
        assert len(relevant_calls(cache_get, "artifact-index")) == 1
        assert len(relevant_calls(cache_set, "artifact-index")) == 0
        assert len(relevant_calls(cache_get, "releasefile")) == 1
        assert len(relevant_calls(cache_set, "releasefile")) == 0
        cache_get.reset_mock()
        cache_set.reset_mock()

        # For other file, get cached manifest but no release file
        result = fetch_release_archive_for_url(release2, dist=None, url="bar")
        assert result is None
        assert len(relevant_calls(cache_get, "artifact-index")) == 1
        assert len(relevant_calls(cache_set, "artifact-index")) == 0
        assert len(relevant_calls(cache_get, "releasefile")) == 0
        assert len(relevant_calls(cache_set, "releasefile")) == 0
        cache_get.reset_mock()
        cache_set.reset_mock()

    @patch("sentry.lang.javascript.processor.CACHE_MAX_VALUE_SIZE", 9)
    @patch("sentry.lang.javascript.processor.cache.set", side_effect=cache.set)
    def test_archive_too_large_for_mem_cache(self, cache_set):
        """cache.set is never called if the archive is too large"""

        def relevant_calls(mock, prefix):
            return [
                call
                for call in mock.mock_calls
                if (
                    call.args and call.args[0] or call.kwargs and call.kwargs["key"] or ""
                ).startswith(prefix)
            ]

        release = Release.objects.create(version="1", organization_id=self.project.organization_id)
        self._create_archive(release, "foo")

        result = fetch_release_archive_for_url(release, dist=None, url="foo")
        assert result is not None
        result.close()
        assert len(relevant_calls(cache_set, "releasefile")) == 0

    @patch(
        "sentry.lang.javascript.processor.ReleaseFile.cache.getfile",
        side_effect=ReleaseFile.cache.getfile,
    )
    def test_archive_too_large_for_disk_cache(self, cache_getfile):
        """ReleaseFile.cache is not used if the archive is too large"""

        release = Release.objects.create(version="1", organization_id=self.project.organization_id)
        self._create_archive(release, "foo")

        # cache.getfile is only called for index, not for the archive
        with override_options({"releasefile.cache-max-archive-size": 9}):
            result = fetch_release_archive_for_url(release, dist=None, url="foo")
        assert result is not None
        result.close()
        assert len(cache_getfile.mock_calls) == 1

    @patch(
        "sentry.lang.javascript.processor.ReleaseFile.cache.getfile",
        side_effect=ReleaseFile.cache.getfile,
    )
    def test_archive_small_enough_for_disk_cache(self, cache_getfile):
        """ReleaseFile.cache is not used if the archive is too large"""

        release = Release.objects.create(version="1", organization_id=self.project.organization_id)
        self._create_archive(release, "foo")

        # cache.getfile is called once for the index, and once for the archive:
        result = fetch_release_archive_for_url(release, dist=None, url="foo")
        assert result is not None
        result.close()
        assert len(cache_getfile.mock_calls) == 2

    @responses.activate
    def test_unicode_body(self):
        responses.add(
            responses.GET,
            "http://example.com",
            body=b'"f\xc3\xb4o bar"'.decode("utf-8"),
            content_type="application/json; charset=utf-8",
        )

        result = fetch_file("http://example.com")

        assert len(responses.calls) == 1

        assert result.url == "http://example.com"
        assert result.body == b'"f\xc3\xb4o bar"'
        assert result.headers == {"content-type": "application/json; charset=utf-8"}
        assert result.encoding == "utf-8"

        # ensure we use the cached result
        result2 = fetch_file("http://example.com")

        assert len(responses.calls) == 1

        assert result == result2

    @responses.activate
    def test_too_large_for_cache(self):
        # make the cache fail
        domain_key = http.get_domain_key("http://example.com")

        original_get = cache.get

        def cache_get(key):
            if key == domain_key:
                return original_get(key)

        with patch("sentry.utils.cache.cache.get", side_effect=cache_get):
            responses.add(
                responses.GET,
                "http://example.com",
                body=b"Stuff",
                content_type="application/json; charset=utf-8",
            )

            with pytest.raises(http.CannotFetch) as exc:
                fetch_file("http://example.com")

            assert exc.value.data["type"] == EventError.TOO_LARGE_FOR_CACHE

            assert cache.get(domain_key) == {
                "type": "too_large_for_cache",
                "url": "http://example.com",
            }

    @responses.activate
    def test_truncated(self):
        url = truncatechars("http://example.com", 3)
        with pytest.raises(http.CannotFetch) as exc:
            fetch_file(url)

        assert exc.value.data["type"] == EventError.JS_MISSING_SOURCE
        assert exc.value.data["url"] == url


class CacheControlTest(unittest.TestCase):
    def test_simple(self):
        headers = {"content-type": "application/json", "cache-control": "max-age=120"}
        assert get_max_age(headers) == 120

    def test_max_and_min(self):
        headers = {
            "content-type": "application/json",
            "cache-control": "max-age=%s" % CACHE_CONTROL_MAX,
        }
        assert get_max_age(headers) == CACHE_CONTROL_MAX

        headers = {
            "content-type": "application/json",
            "cache-control": "max-age=%s" % CACHE_CONTROL_MIN,
        }
        assert get_max_age(headers) == CACHE_CONTROL_MIN

    def test_out_of_bounds(self):
        greater_than_max = CACHE_CONTROL_MAX + 1
        headers = {
            "content-type": "application/json",
            "cache-control": "max-age=%s" % greater_than_max,
        }
        assert get_max_age(headers) == CACHE_CONTROL_MAX

        less_than_min = CACHE_CONTROL_MIN - 1
        headers = {
            "content-type": "application/json",
            "cache-control": "max-age=%s" % less_than_min,
        }
        assert get_max_age(headers) == CACHE_CONTROL_MIN

    def test_no_cache_control(self):
        headers = {"content-type": "application/json"}
        assert get_max_age(headers) == CACHE_CONTROL_MIN

    def test_additional_cache_control_values(self):
        headers = {
            "content-type": "application/json",
            "cache-control": "private, s-maxage=60, max-age=120",
        }
        assert get_max_age(headers) == 120

    def test_valid_input(self):
        headers = {"content-type": "application/json", "cache-control": "max-age=12df0sdgfjhdgf"}
        assert get_max_age(headers) == CACHE_CONTROL_MIN

        headers = {"content-type": "application/json", "cache-control": "max-age=df0sdgfjhdgf"}
        assert get_max_age(headers) == CACHE_CONTROL_MIN


class DiscoverSourcemapTest(unittest.TestCase):
    # discover_sourcemap(result)
    def test_simple(self):
        result = http.UrlResult("http://example.com", {}, b"", 200, None)
        assert discover_sourcemap(result) is None

        result = http.UrlResult(
            "http://example.com",
            {"x-sourcemap": "http://example.com/source.map.js"},
            b"",
            200,
            None,
        )
        assert discover_sourcemap(result) == "http://example.com/source.map.js"

        result = http.UrlResult(
            "http://example.com", {"sourcemap": "http://example.com/source.map.js"}, b"", 200, None
        )
        assert discover_sourcemap(result) == "http://example.com/source.map.js"

        result = http.UrlResult(
            "http://example.com",
            {},
            b"//@ sourceMappingURL=http://example.com/source.map.js\nconsole.log(true)",
            200,
            None,
        )
        assert discover_sourcemap(result) == "http://example.com/source.map.js"

        result = http.UrlResult(
            "http://example.com",
            {},
            b"//# sourceMappingURL=http://example.com/source.map.js\nconsole.log(true)",
            200,
            None,
        )
        assert discover_sourcemap(result) == "http://example.com/source.map.js"

        result = http.UrlResult(
            "http://example.com",
            {},
            b"console.log(true)\n//@ sourceMappingURL=http://example.com/source.map.js",
            200,
            None,
        )
        assert discover_sourcemap(result) == "http://example.com/source.map.js"

        result = http.UrlResult(
            "http://example.com",
            {},
            b"console.log(true)\n//# sourceMappingURL=http://example.com/source.map.js",
            200,
            None,
        )
        assert discover_sourcemap(result) == "http://example.com/source.map.js"

        result = http.UrlResult(
            "http://example.com",
            {},
            b"console.log(true)\n//# sourceMappingURL=http://example.com/source.map.js\n//# sourceMappingURL=http://example.com/source2.map.js",
            200,
            None,
        )
        assert discover_sourcemap(result) == "http://example.com/source2.map.js"

        # sourceMappingURL found directly after code w/o newline
        result = http.UrlResult(
            "http://example.com",
            {},
            b"console.log(true);//# sourceMappingURL=http://example.com/source.map.js",
            200,
            None,
        )
        assert discover_sourcemap(result) == "http://example.com/source.map.js"

        result = http.UrlResult(
            "http://example.com", {}, b"//# sourceMappingURL=app.map.js/*ascii:lol*/", 200, None
        )
        assert discover_sourcemap(result) == "http://example.com/app.map.js"

        result = http.UrlResult(
            "http://example.com", {}, b"//# sourceMappingURL=/*lol*/", 200, None
        )
        with pytest.raises(AssertionError):
            discover_sourcemap(result)


# NB: despite the very close name, this class (singular Module) is in fact
# different from the GenerateModulesTest (plural Modules) class below
class GenerateModuleTest(unittest.TestCase):
    def test_simple(self):
        assert generate_module(None) == "<unknown module>"
        assert generate_module("http://example.com/foo.js") == "foo"
        assert generate_module("http://example.com/foo/bar.js") == "foo/bar"
        assert generate_module("http://example.com/js/foo/bar.js") == "foo/bar"
        assert generate_module("http://example.com/javascript/foo/bar.js") == "foo/bar"
        assert generate_module("http://example.com/1.0/foo/bar.js") == "foo/bar"
        assert generate_module("http://example.com/v1/foo/bar.js") == "foo/bar"
        assert generate_module("http://example.com/v1.0.0/foo/bar.js") == "foo/bar"
        assert generate_module("http://example.com/_baz/foo/bar.js") == "foo/bar"
        assert generate_module("http://example.com/1/2/3/foo/bar.js") == "foo/bar"
        assert generate_module("http://example.com/abcdef0/foo/bar.js") == "foo/bar"
        assert (
            generate_module(
                "http://example.com/92cd589eca8235e7b373bf5ae94ebf898e3b949c/foo/bar.js"
            )
            == "foo/bar"
        )
        assert (
            generate_module("http://example.com/7d6d00eae0ceccdc7ee689659585d95f/foo/bar.js")
            == "foo/bar"
        )
        assert generate_module("http://example.com/foo/bar.coffee") == "foo/bar"
        assert generate_module("http://example.com/foo/bar.js?v=1234") == "foo/bar"
        assert generate_module("/foo/bar.js") == "foo/bar"
        assert generate_module("/foo/bar.ts") == "foo/bar"
        assert generate_module("../../foo/bar.js") == "foo/bar"
        assert generate_module("../../foo/bar.ts") == "foo/bar"
        assert generate_module("../../foo/bar.awesome") == "foo/bar"
        assert generate_module("../../foo/bar") == "foo/bar"
        assert generate_module("/foo/bar-7d6d00eae0ceccdc7ee689659585d95f.js") == "foo/bar"
        assert generate_module("/bower_components/foo/bar.js") == "foo/bar"
        assert generate_module("/node_modules/foo/bar.js") == "foo/bar"
        assert (
            generate_module("http://example.com/vendor.92cd589eca8235e7b373bf5ae94ebf898e3b949c.js")
            == "vendor"
        )
        assert (
            generate_module(
                "/a/javascripts/application-bundle-149360d3414c26adac3febdf6832e25c.min.js"
            )
            == "a/javascripts/application-bundle"
        )
        assert generate_module("https://example.com/libs/libs-20150417171659.min.js") == "libs/libs"
        assert (
            generate_module("webpack:///92cd589eca8235e7b373bf5ae94ebf898e3b949c/vendor.js")
            == "vendor"
        )
        assert (
            generate_module("webpack:///92cd589eca8235e7b373bf5ae94ebf898e3b949c/vendor.js")
            == "vendor"
        )
        assert (
            generate_module("app:///92cd589eca8235e7b373bf5ae94ebf898e3b949c/vendor.js") == "vendor"
        )
        assert (
            generate_module("app:///example/92cd589eca8235e7b373bf5ae94ebf898e3b949c/vendor.js")
            == "vendor"
        )
        assert (
            generate_module("~/app/components/projectHeader/projectSelector.jsx")
            == "app/components/projectHeader/projectSelector"
        )


class GetFunctionForTokenTest(unittest.TestCase):
    # There is no point in pulling down `SourceMapCacheToken` and creating a constructor for it.
    def get_token(self, fn_name, token_name=None):
        class Token:
            def __init__(self, fn_name, token_name):
                self.name = token_name
                self.function_name = fn_name

        return Token(fn_name, token_name)

    def get_frame(self, frame):
        processable_frame = ProcessableFrame(frame, 0, None, None, None)
        processable_frame.data = {"token": None}
        return processable_frame

    def test_valid_name(self):
        frame = self.get_frame({"function": "original"})
        token = self.get_token("lookedup")
        assert get_function_for_token(frame, token) == "lookedup"

    def test_fallback_to_previous_frames_token_if_useless_name(self):
        previous_frame = self.get_frame({})
        previous_frame.data["token"] = self.get_token("previous_fn", "previous_name")
        frame = self.get_frame({"function": None})
        token = self.get_token("__webpack_require__")
        assert get_function_for_token(frame, token, previous_frame) == "previous_name"

    def test_fallback_to_useless_name(self):
        previous_frame = self.get_frame({"data": {"token": None}})
        frame = self.get_frame({"function": None})
        token = self.get_token("__webpack_require__")
        assert get_function_for_token(frame, token, previous_frame) == "__webpack_require__"

    def test_fallback_to_original_name(self):
        previous_frame = self.get_frame({"data": {"token": None}})
        frame = self.get_frame({"function": "original"})
        token = self.get_token("__webpack_require__")
        assert get_function_for_token(frame, token, previous_frame) == "original"


class FetchSourcemapTest(TestCase):
    def test_simple_base64(self):
        smap_view = fetch_sourcemap(base64_sourcemap)
        token = smap_view.lookup(1, 1, 0)

        assert token.src == "/test.js"
        assert token.line == 1
        assert token.col == 1
        assert token.context_line == 'console.log("hello, World!")'

    def test_base64_without_padding(self):
        smap_view = fetch_sourcemap(base64_sourcemap.rstrip("="))
        token = smap_view.lookup(1, 1, 0)

        assert token.src == "/test.js"
        assert token.line == 1
        assert token.col == 1
        assert token.context_line == 'console.log("hello, World!")'

    def test_broken_base64(self):
        with pytest.raises(UnparseableSourcemap):
            fetch_sourcemap("data:application/json;base64,xxx")

    @responses.activate
    def test_garbage_json(self):
        responses.add(
            responses.GET, "http://example.com", body="xxxx", content_type="application/json"
        )

        with pytest.raises(UnparseableSourcemap):
            fetch_sourcemap("http://example.com")


class TrimLineTest(unittest.TestCase):
    long_line = "The public is more familiar with bad design than good design. It is, in effect, conditioned to prefer bad design, because that is what it lives with. The new becomes threatening, the old reassuring."

    def test_simple(self):
        assert trim_line("foo") == "foo"
        assert (
            trim_line(self.long_line)
            == "The public is more familiar with bad design than good design. It is, in effect, conditioned to prefer bad design, because that is what it li {snip}"
        )
        assert (
            trim_line(self.long_line, column=10)
            == "The public is more familiar with bad design than good design. It is, in effect, conditioned to prefer bad design, because that is what it li {snip}"
        )
        assert (
            trim_line(self.long_line, column=66)
            == "{snip} blic is more familiar with bad design than good design. It is, in effect, conditioned to prefer bad design, because that is what it lives wi {snip}"
        )
        assert (
            trim_line(self.long_line, column=190)
            == "{snip} gn. It is, in effect, conditioned to prefer bad design, because that is what it lives with. The new becomes threatening, the old reassuring."
        )
        assert (
            trim_line(self.long_line, column=9999)
            == "{snip} gn. It is, in effect, conditioned to prefer bad design, because that is what it lives with. The new becomes threatening, the old reassuring."
        )


class GenerateModulesTest(unittest.TestCase):
    def test_ensure_module_names(self):
        from sentry.lang.javascript.plugin import generate_modules

        data = {
            "message": "hello",
            "platform": "javascript",
            "exception": {
                "values": [
                    {
                        "type": "Error",
                        "stacktrace": {
                            "frames": [
                                {
                                    "filename": "foo.js",
                                    "lineno": 4,
                                    "colno": 0,
                                    "function": "thing",
                                },
                                {
                                    "abs_path": "http://example.com/foo/bar.js",
                                    "filename": "bar.js",
                                    "lineno": 1,
                                    "colno": 0,
                                    "function": "oops",
                                },
                            ]
                        },
                    }
                ]
            },
        }
        generate_modules(data)
        exc = data["exception"]["values"][0]
        assert exc["stacktrace"]["frames"][1]["module"] == "foo/bar"

    def test_generate_modules_skips_none(self):
        from sentry.lang.javascript.plugin import generate_modules

        expected = {
            "culprit": "",
            "exception": {
                "values": [
                    None,
                    {},
                    {"value": "MyError", "stacktrace": None},
                    {"value": "MyError", "stacktrace": {"frames": None}},
                    {"value": "MyError", "stacktrace": {"frames": [None]}},
                ]
            },
        }

        actual = deepcopy(expected)
        generate_modules(actual)
        assert actual == expected


class ErrorMappingTest(unittest.TestCase):
    @responses.activate
    def test_react_error_mapping_resolving(self):
        responses.add(
            responses.GET,
            REACT_MAPPING_URL,
            body=r"""
        {
          "108": "%s.getChildContext(): key \"%s\" is not defined in childContextTypes.",
          "109": "%s.render(): A valid React element (or null) must be returned. You may have returned undefined, an array or some other invalid object.",
          "110": "Stateless function components cannot have refs."
        }
        """,
            content_type="application/json",
        )

        for x in range(3):
            data = {
                "platform": "javascript",
                "exception": {
                    "values": [
                        {
                            "type": "InvariantViolation",
                            "value": (
                                "Minified React error #109; visit http://facebook"
                                ".github.io/react/docs/error-decoder.html?invariant="
                                "109&args[]=Component for the full message or use "
                                "the non-minified dev environment for full errors "
                                "and additional helpful warnings."
                            ),
                            "stacktrace": {
                                "frames": [
                                    {
                                        "abs_path": "http://example.com/foo.js",
                                        "filename": "foo.js",
                                        "lineno": 4,
                                        "colno": 0,
                                    },
                                    {
                                        "abs_path": "http://example.com/foo.js",
                                        "filename": "foo.js",
                                        "lineno": 1,
                                        "colno": 0,
                                    },
                                ]
                            },
                        }
                    ]
                },
            }

            assert rewrite_exception(data)

            assert data["exception"]["values"][0]["value"] == (
                "Component.render(): A valid React element (or null) must be "
                "returned. You may have returned undefined, an array or "
                "some other invalid object."
            )

    @responses.activate
    def test_react_error_mapping_empty_args(self):
        responses.add(
            responses.GET,
            REACT_MAPPING_URL,
            body=r"""
        {
          "108": "%s.getChildContext(): key \"%s\" is not defined in childContextTypes."
        }
        """,
            content_type="application/json",
        )

        data = {
            "platform": "javascript",
            "exception": {
                "values": [
                    {
                        "type": "InvariantViolation",
                        "value": (
                            "Minified React error #108; visit http://facebook"
                            ".github.io/react/docs/error-decoder.html?invariant="
                            "108&args[]=Component&args[]= for the full message "
                            "or use the non-minified dev environment for full "
                            "errors and additional helpful warnings."
                        ),
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "http://example.com/foo.js",
                                    "filename": "foo.js",
                                    "lineno": 4,
                                    "colno": 0,
                                }
                            ]
                        },
                    }
                ]
            },
        }

        assert rewrite_exception(data)

        assert data["exception"]["values"][0]["value"] == (
            'Component.getChildContext(): key "" is not defined in ' "childContextTypes."
        )

    @responses.activate
    def test_react_error_mapping_truncated(self):
        responses.add(
            responses.GET,
            REACT_MAPPING_URL,
            body=r"""
        {
          "108": "%s.getChildContext(): key \"%s\" is not defined in childContextTypes."
        }
        """,
            content_type="application/json",
        )

        data = {
            "platform": "javascript",
            "exception": {
                "values": [
                    {
                        "type": "InvariantViolation",
                        "value": (
                            "Minified React error #108; visit http://facebook"
                            ".github.io/react/docs/error-decoder.html?\u2026"
                        ),
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "http://example.com/foo.js",
                                    "filename": "foo.js",
                                    "lineno": 4,
                                    "colno": 0,
                                }
                            ]
                        },
                    }
                ]
            },
        }

        assert rewrite_exception(data)

        assert data["exception"]["values"][0]["value"] == (
            '<redacted>.getChildContext(): key "<redacted>" is not defined in ' "childContextTypes."
        )

    @responses.activate
    def test_skip_none_values(self):
        expected = {"exception": {"values": [None, {}]}}

        actual = deepcopy(expected)
        assert not rewrite_exception(actual)

        assert actual == expected


class CacheSourceTest(TestCase):
    def test_file_no_source_records_error(self):
        """
        If we can't find a given file, either on the release or by scraping, an
        error should be recorded.
        """

        project = self.create_project()

        processor = JavaScriptStacktraceProcessor(data={}, stacktrace_infos=None, project=project)

        # no release on the event, so won't find file in database
        assert processor.release is None

        # not a real url, so won't find file on the internet
        abs_path = "app:///i/dont/exist.js"

        # before caching, no errors
        assert len(processor.cache.get_errors(abs_path)) == 0

        processor.cache_source(abs_path)

        # now we have an error
        assert len(processor.cache.get_errors(abs_path)) == 1
        assert processor.cache.get_errors(abs_path)[0] == {"url": abs_path, "type": "js_no_source"}

    def test_node_modules_file_no_source_no_error(self):
        """
        If someone hasn't uploaded node_modules (which most people don't), it
        shouldn't complain about a source file being missing.
        """

        project = self.create_project()
        processor = JavaScriptStacktraceProcessor(data={}, stacktrace_infos=None, project=project)

        # no release on the event, so won't find file in database
        assert processor.release is None

        # not a real url, so won't find file on the internet
        abs_path = "app:///../node_modules/i/dont/exist.js"

        processor.cache_source(abs_path)

        # no errors, even though the file can't have been found
        assert len(processor.cache.get_errors(abs_path)) == 0

    def test_node_modules_file_with_source_is_used(self):
        """
        If someone has uploaded node_modules, files in there should be treated like
        any other files (in other words, they should land in the cache with no errors).
        """

        project = self.create_project()
        release = self.create_release(project=project, version="12.31.12")

        abs_path = "app:///../node_modules/some-package/index.js"
        self.create_release_file(release_id=release.id, name=abs_path)

        processor = JavaScriptStacktraceProcessor(
            data={"release": release.version}, stacktrace_infos=None, project=project
        )
        # in real life the preprocess step will pull release out of the data
        # dictionary passed to the JavaScriptStacktraceProcessor constructor,
        # but since this is just a unit test, we have to set it manually
        processor.release = release

        processor.cache_source(abs_path)

        # file is cached, no errors are generated
        assert processor.cache.get(abs_path)
        assert len(processor.cache.get_errors(abs_path)) == 0

    @patch("sentry.lang.javascript.processor.discover_sourcemap")
    def test_node_modules_file_with_source_but_no_map_records_error(self, mock_discover_sourcemap):
        """
        If someone has uploaded node_modules, but is missing maps, it should complain
        so that they either a) upload the maps, or b) don't upload the source files.
        """

        map_url = "app:///../node_modules/some-package/index.js.map"
        mock_discover_sourcemap.return_value = map_url

        project = self.create_project()
        release = self.create_release(project=project, version="12.31.12")

        abs_path = "app:///../node_modules/some-package/index.js"
        self.create_release_file(release_id=release.id, name=abs_path)

        processor = JavaScriptStacktraceProcessor(
            data={"release": release.version}, stacktrace_infos=None, project=project
        )
        # in real life the preprocess step will pull release out of the data
        # dictionary passed to the JavaScriptStacktraceProcessor constructor,
        # but since this is just a unit test, we have to set it manually
        processor.release = release

        # before caching, no errors
        assert len(processor.cache.get_errors(abs_path)) == 0

        processor.cache_source(abs_path)

        # now we have an error
        assert len(processor.cache.get_errors(abs_path)) == 1
        assert processor.cache.get_errors(abs_path)[0] == {"url": map_url, "type": "js_no_source"}
