import os.path
import zipfile
from base64 import b64encode
from io import BytesIO
from unittest.mock import patch

import responses
from django.utils.encoding import force_bytes

from sentry.models import File, Release, ReleaseFile
from sentry.models.releasefile import update_artifact_index
from sentry.testutils import RelayStoreHelper, SnubaTestCase, TransactionTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.utils import json

BASE64_SOURCEMAP = "data:application/json;base64," + (
    b64encode(
        b'{"version":3,"file":"generated.js","sources":["/test.js"],"names":[],"mappings":"AAAA","sourcesContent":['
        b'"console.log(\\"hello, World!\\")"]}'
    )
    .decode("utf-8")
    .replace("\n", "")
)


def get_fixture_path(name):
    return os.path.join(os.path.dirname(__file__), "fixtures", name)


def load_fixture(name):
    with open(get_fixture_path(name), "rb") as fp:
        return fp.read()


class JavascriptIntegrationTest(RelayStoreHelper, SnubaTestCase, TransactionTestCase):
    def setUp(self):
        super().setUp()
        self.min_ago = iso_format(before_now(minutes=1))

    def test_adds_contexts_without_device(self):
        data = {
            "timestamp": self.min_ago,
            "message": "hello",
            "platform": "javascript",
            "request": {
                "url": "http://example.com",
                "headers": [
                    [
                        "User-Agent",
                        "Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/28.0.1500.72 Safari/537.36",
                    ]
                ],
            },
        }

        event = self.post_and_retrieve_event(data)
        contexts = event.interfaces["contexts"].to_json()
        assert contexts.get("os") == {"name": "Windows", "version": "8", "type": "os"}
        assert contexts.get("device") is None

    def test_adds_contexts_with_device(self):
        data = {
            "timestamp": self.min_ago,
            "message": "hello",
            "platform": "javascript",
            "request": {
                "url": "http://example.com",
                "headers": [
                    [
                        "User-Agent",
                        "Mozilla/5.0 (Linux; U; Android 4.3; en-us; SCH-R530U Build/JSS15J) AppleWebKit/534.30 ("
                        "KHTML, like Gecko) Version/4.0 Mobile Safari/534.30 USCC-R530U",
                    ]
                ],
            },
        }

        event = self.post_and_retrieve_event(data)

        contexts = event.interfaces["contexts"].to_json()
        assert contexts.get("os") == {"name": "Android", "type": "os", "version": "4.3"}
        assert contexts.get("browser") == {"name": "Android", "type": "browser", "version": "4.3"}
        assert contexts.get("device") == {
            "family": "Samsung SCH-R530U",
            "type": "device",
            "model": "SCH-R530U",
            "brand": "Samsung",
        }

    def test_adds_contexts_with_ps4_device(self):
        data = {
            "timestamp": self.min_ago,
            "message": "hello",
            "platform": "javascript",
            "request": {
                "url": "http://example.com",
                "headers": [
                    [
                        "User-Agent",
                        "Mozilla/5.0 (PlayStation 4 3.55) AppleWebKit/537.78 (KHTML, like Gecko)",
                    ]
                ],
            },
        }

        event = self.post_and_retrieve_event(data)

        contexts = event.interfaces["contexts"].to_json()
        assert contexts.get("os") is None
        assert contexts.get("browser") is None
        assert contexts.get("device") == {
            "family": "PlayStation 4",
            "type": "device",
            "model": "PlayStation 4",
            "brand": "Sony",
        }

    @patch("sentry.lang.javascript.processor.fetch_file")
    def test_source_expansion(self, mock_fetch_file):
        data = {
            "timestamp": self.min_ago,
            "message": "hello",
            "platform": "javascript",
            "exception": {
                "values": [
                    {
                        "type": "Error",
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

        mock_fetch_file.return_value.body = force_bytes("\n".join("hello world"))
        mock_fetch_file.return_value.encoding = None
        mock_fetch_file.return_value.headers = {}

        event = self.post_and_retrieve_event(data)

        mock_fetch_file.assert_called_once_with(
            "http://example.com/foo.js",
            project=self.project,
            release=None,
            dist=None,
            allow_scraping=True,
        )

        exception = event.interfaces["exception"]
        frame_list = exception.values[0].stacktrace.frames

        frame = frame_list[0]
        assert frame.pre_context == ["h", "e", "l"]
        assert frame.context_line == "l"
        assert frame.post_context == ["o", " ", "w", "o", "r"]

        frame = frame_list[1]
        assert not frame.pre_context
        assert frame.context_line == "h"
        assert frame.post_context == ["e", "l", "l", "o", " "]

        # no source map means no raw_stacktrace
        assert exception.values[0].raw_stacktrace is None

    @patch("sentry.lang.javascript.processor.fetch_file")
    @patch("sentry.lang.javascript.processor.discover_sourcemap")
    def test_inlined_sources(self, mock_discover_sourcemap, mock_fetch_file):
        data = {
            "timestamp": self.min_ago,
            "message": "hello",
            "platform": "javascript",
            "exception": {
                "values": [
                    {
                        "type": "Error",
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "http://example.com/test.min.js",
                                    "filename": "test.js",
                                    "lineno": 1,
                                    "colno": 1,
                                }
                            ]
                        },
                    }
                ]
            },
        }

        mock_discover_sourcemap.return_value = BASE64_SOURCEMAP

        mock_fetch_file.return_value.url = "http://example.com/test.min.js"
        mock_fetch_file.return_value.body = force_bytes("\n".join("<generated source>"))
        mock_fetch_file.return_value.encoding = None

        event = self.post_and_retrieve_event(data)

        mock_fetch_file.assert_called_once_with(
            "http://example.com/test.min.js",
            project=self.project,
            release=None,
            dist=None,
            allow_scraping=True,
        )

        exception = event.interfaces["exception"]
        frame_list = exception.values[0].stacktrace.frames

        frame = frame_list[0]
        assert not frame.pre_context
        assert frame.context_line == 'console.log("hello, World!")'
        assert not frame.post_context
        assert frame.data["sourcemap"] == "http://example.com/test.min.js"

    @responses.activate
    def test_error_message_translations(self):
        data = {
            "timestamp": self.min_ago,
            "message": "hello",
            "platform": "javascript",
            "logentry": {
                "formatted": "ReferenceError: Impossible de d\xe9finir une propri\xe9t\xe9 \xab foo \xbb : objet non "
                "extensible"
            },
            "exception": {
                "values": [
                    {"type": "Error", "value": "P\u0159\xedli\u0161 mnoho soubor\u016f"},
                    {
                        "type": "Error",
                        "value": "foo: wyst\u0105pi\u0142 nieoczekiwany b\u0142\u0105d podczas pr\xf3by uzyskania "
                        "informacji o metadanych",
                    },
                ]
            },
        }

        event = self.post_and_retrieve_event(data)

        message = event.interfaces["logentry"]
        assert (
            message.formatted
            == "ReferenceError: Cannot define property 'foo': object is not extensible"
        )

        exception = event.interfaces["exception"]
        assert exception.values[0].value == "Too many files"
        assert (
            exception.values[1].value
            == "foo: an unexpected failure occurred while trying to obtain metadata information"
        )

    @responses.activate
    def test_sourcemap_source_expansion(self):
        responses.add(
            responses.GET,
            "http://example.com/file.min.js",
            body=load_fixture("file.min.js"),
            content_type="application/javascript; charset=utf-8",
        )
        responses.add(
            responses.GET,
            "http://example.com/file1.js",
            body=load_fixture("file1.js"),
            content_type="application/javascript; charset=utf-8",
        )
        responses.add(
            responses.GET,
            "http://example.com/file2.js",
            body=load_fixture("file2.js"),
            content_type="application/javascript; charset=utf-8",
        )
        responses.add(
            responses.GET,
            "http://example.com/file.sourcemap.js",
            body=load_fixture("file.sourcemap.js"),
            content_type="application/javascript; charset=utf-8",
        )
        responses.add(responses.GET, "http://example.com/index.html", body="Not Found", status=404)

        data = {
            "timestamp": self.min_ago,
            "message": "hello",
            "platform": "javascript",
            "exception": {
                "values": [
                    {
                        "type": "Error",
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "http://example.com/file.min.js",
                                    "filename": "file.min.js",
                                    "lineno": 1,
                                    "colno": 39,
                                },
                                # NOTE: Intentionally source is not retrieved from this HTML file
                                {
                                    "function": 'function: "HTMLDocument.<anonymous>"',
                                    "abs_path": "http//example.com/index.html",
                                    "filename": "index.html",
                                    "lineno": 283,
                                    "colno": 17,
                                    "in_app": False,
                                },
                            ]
                        },
                    }
                ]
            },
        }

        event = self.post_and_retrieve_event(data)

        assert event.data["errors"] == [
            {"type": "js_no_source", "url": "http//example.com/index.html"}
        ]

        exception = event.interfaces["exception"]
        frame_list = exception.values[0].stacktrace.frames

        frame = frame_list[0]
        assert frame.pre_context == ["function add(a, b) {", '\t"use strict";']
        expected = "\treturn a + b; // fôo"
        assert frame.context_line == expected
        assert frame.post_context == ["}", ""]

        raw_frame_list = exception.values[0].raw_stacktrace.frames
        raw_frame = raw_frame_list[0]
        assert not raw_frame.pre_context
        assert (
            raw_frame.context_line
            == 'function add(a,b){"use strict";return a+b}function multiply(a,b){"use strict";return a*b}function '
            'divide(a,b){"use strict";try{return multip {snip}'
        )
        assert raw_frame.post_context == ["//@ sourceMappingURL=file.sourcemap.js", ""]
        assert raw_frame.lineno == 1

        # Since we couldn't expand source for the 2nd frame, both
        # its raw and original form should be identical
        assert raw_frame_list[1] == frame_list[1]

    @responses.activate
    def test_sourcemap_embedded_source_expansion(self):
        responses.add(
            responses.GET,
            "http://example.com/embedded.js",
            body=load_fixture("embedded.js"),
            content_type="application/javascript; charset=utf-8",
        )
        responses.add(
            responses.GET,
            "http://example.com/embedded.js.map",
            body=load_fixture("embedded.js.map"),
            content_type="application/json; charset=utf-8",
        )
        responses.add(responses.GET, "http://example.com/index.html", body="Not Found", status=404)

        data = {
            "timestamp": self.min_ago,
            "message": "hello",
            "platform": "javascript",
            "exception": {
                "values": [
                    {
                        "type": "Error",
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "http://example.com/embedded.js",
                                    "filename": "file.min.js",
                                    "lineno": 1,
                                    "colno": 39,
                                },
                                # NOTE: Intentionally source is not retrieved from this HTML file
                                {
                                    "function": 'function: "HTMLDocument.<anonymous>"',
                                    "abs_path": "http//example.com/index.html",
                                    "filename": "index.html",
                                    "lineno": 283,
                                    "colno": 17,
                                    "in_app": False,
                                },
                            ]
                        },
                    }
                ]
            },
        }

        event = self.post_and_retrieve_event(data)

        assert event.data["errors"] == [
            {"type": "js_no_source", "url": "http//example.com/index.html"}
        ]

        exception = event.interfaces["exception"]
        frame_list = exception.values[0].stacktrace.frames

        frame = frame_list[0]
        assert frame.pre_context == ["function add(a, b) {", '\t"use strict";']
        expected = "\treturn a + b; // fôo"
        assert frame.context_line == expected
        assert frame.post_context == ["}", ""]

    @responses.activate
    def test_sourcemap_nofiles_source_expansion(self):
        project = self.project
        release = Release.objects.create(organization_id=project.organization_id, version="abc")
        release.add_project(project)

        with open(get_fixture_path("nofiles.js"), "rb") as f:
            f_minified = File.objects.create(
                name="nofiles.js", type="release.file", headers={"Content-Type": "application/json"}
            )
            f_minified.putfile(f)
        ReleaseFile.objects.create(
            name=f"~/{f_minified.name}",
            release_id=release.id,
            organization_id=project.organization_id,
            file=f_minified,
        )

        with open(get_fixture_path("nofiles.js.map"), "rb") as f:
            f_sourcemap = File.objects.create(
                name="nofiles.js.map",
                type="release.file",
                headers={"Content-Type": "application/json"},
            )
            f_sourcemap.putfile(f)
        ReleaseFile.objects.create(
            name=f"app:///{f_sourcemap.name}",
            release_id=release.id,
            organization_id=project.organization_id,
            file=f_sourcemap,
        )

        data = {
            "timestamp": self.min_ago,
            "message": "hello",
            "platform": "javascript",
            "release": "abc",
            "exception": {
                "values": [
                    {
                        "type": "Error",
                        "stacktrace": {
                            "frames": [{"abs_path": "app:///nofiles.js", "lineno": 1, "colno": 39}]
                        },
                    }
                ]
            },
        }

        event = self.post_and_retrieve_event(data)

        assert "errors" not in event.data

        exception = event.interfaces["exception"]
        frame_list = exception.values[0].stacktrace.frames

        assert len(frame_list) == 1
        frame = frame_list[0]
        assert frame.abs_path == "app:///nofiles.js.map"
        assert frame.pre_context == ["function multiply(a, b) {", '\t"use strict";']
        assert frame.context_line == "\treturn a * b;"
        assert frame.post_context == [
            "}",
            "function divide(a, b) {",
            '\t"use strict";',
            "\ttry {",
            "\t\treturn multiply(add(a, b), a, b) / c;",
        ]
        # TODO(smcache): Assertions below are the one that're correct. Use it when migrating from legacy processor.
        # assert frame.abs_path == "app:///nofiles.js"
        # assert frame.pre_context == ["function add(a, b) {", '\t"use strict";']
        # assert frame.context_line == "\treturn a + b; // fôo"
        # assert frame.post_context == ["}", ""]

    @responses.activate
    def test_indexed_sourcemap_source_expansion(self):
        responses.add(
            responses.GET,
            "http://example.com/indexed.min.js",
            body=load_fixture("indexed.min.js"),
            content_type="application/javascript; charset=utf-8",
        )
        responses.add(
            responses.GET,
            "http://example.com/file1.js",
            body=load_fixture("file1.js"),
            content_type="application/javascript; charset=utf-8",
        )
        responses.add(
            responses.GET,
            "http://example.com/file2.js",
            body=load_fixture("file2.js"),
            content_type="application/javascript; charset=utf-8",
        )
        responses.add(
            responses.GET,
            "http://example.com/indexed.sourcemap.js",
            body=load_fixture("indexed.sourcemap.js"),
            content_type="application/json; charset=utf-8",
        )

        data = {
            "timestamp": self.min_ago,
            "message": "hello",
            "platform": "javascript",
            "exception": {
                "values": [
                    {
                        "type": "Error",
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "http://example.com/indexed.min.js",
                                    "filename": "indexed.min.js",
                                    "lineno": 1,
                                    "colno": 39,
                                },
                                {
                                    "abs_path": "http://example.com/indexed.min.js",
                                    "filename": "indexed.min.js",
                                    "lineno": 2,
                                    "colno": 44,
                                },
                            ]
                        },
                    }
                ]
            },
        }

        event = self.post_and_retrieve_event(data)

        assert "errors" not in event.data

        exception = event.interfaces["exception"]
        frame_list = exception.values[0].stacktrace.frames

        frame = frame_list[0]
        assert frame.pre_context == ["function add(a, b) {", '\t"use strict";']

        expected = "\treturn a + b; // fôo"
        assert frame.context_line == expected
        assert frame.post_context == ["}", ""]

        raw_frame_list = exception.values[0].raw_stacktrace.frames
        raw_frame = raw_frame_list[0]
        assert not raw_frame.pre_context
        assert raw_frame.context_line == 'function add(a,b){"use strict";return a+b}'
        assert raw_frame.post_context == [
            'function multiply(a,b){"use strict";return a*b}function divide(a,b){"use strict";try{return multiply('
            "add(a,b),a,b)/c}catch(e){Raven.captureE {snip}",
            "//# sourceMappingURL=indexed.sourcemap.js",
            "",
        ]
        assert raw_frame.lineno == 1

        frame = frame_list[1]
        assert frame.pre_context == ["function multiply(a, b) {", '\t"use strict";']
        assert frame.context_line == "\treturn a * b;"
        assert frame.post_context == [
            "}",
            "function divide(a, b) {",
            '\t"use strict";',
            "\ttry {",
            "\t\treturn multiply(add(a, b), a, b) / c;",
        ]

        raw_frame = raw_frame_list[1]
        assert raw_frame.pre_context == ['function add(a,b){"use strict";return a+b}']
        assert (
            raw_frame.context_line
            == 'function multiply(a,b){"use strict";return a*b}function divide(a,b){"use strict";try{return multiply('
            "add(a,b),a,b)/c}catch(e){Raven.captureE {snip}"
        )
        assert raw_frame.post_context == ["//# sourceMappingURL=indexed.sourcemap.js", ""]
        assert raw_frame.lineno == 2

    @responses.activate
    def test_expansion_via_release_artifacts(self):
        project = self.project
        release = Release.objects.create(organization_id=project.organization_id, version="abc")
        release.add_project(project)

        # file.min.js
        # ------------

        with open(get_fixture_path("file.min.js"), "rb") as f:
            f_minified = File.objects.create(
                name="file.min.js",
                type="release.file",
                headers={"Content-Type": "application/json"},
            )
            f_minified.putfile(f)

        # Intentionally omit hostname - use alternate artifact path lookup instead
        # /file1.js vs http://example.com/file1.js
        ReleaseFile.objects.create(
            name=f"~/{f_minified.name}?foo=bar",
            release_id=release.id,
            organization_id=project.organization_id,
            file=f_minified,
        )

        # file1.js
        # ---------

        with open(get_fixture_path("file1.js"), "rb") as f:
            f1 = File.objects.create(
                name="file1.js", type="release.file", headers={"Content-Type": "application/json"}
            )
            f1.putfile(f)

        ReleaseFile.objects.create(
            name=f"http://example.com/{f1.name}",
            release_id=release.id,
            organization_id=project.organization_id,
            file=f1,
        )

        # file2.js
        # ----------

        with open(get_fixture_path("file2.js"), "rb") as f:
            f2 = File.objects.create(
                name="file2.js", type="release.file", headers={"Content-Type": "application/json"}
            )
            f2.putfile(f)
        ReleaseFile.objects.create(
            name=f"http://example.com/{f2.name}",
            release_id=release.id,
            organization_id=project.organization_id,
            file=f2,
        )

        # To verify that the full url has priority over the relative url,
        # we will also add a second ReleaseFile alias for file2.js (f3) w/o
        # hostname that points to an empty file. If the processor chooses
        # this empty file over the correct file2.js, it will not locate
        # context for the 2nd frame.
        with open(get_fixture_path("empty.js"), "rb") as f:
            f2_empty = File.objects.create(
                name="empty.js", type="release.file", headers={"Content-Type": "application/json"}
            )
            f2_empty.putfile(f)
        ReleaseFile.objects.create(
            name=f"~/{f2.name}",  # intentionally using f2.name ("file2.js")
            release_id=release.id,
            organization_id=project.organization_id,
            file=f2_empty,
        )

        # sourcemap
        # ----------

        with open(get_fixture_path("file.sourcemap.js"), "rb") as f:
            f_sourcemap = File.objects.create(
                name="file.sourcemap.js",
                type="release.file",
                headers={"Content-Type": "application/json"},
            )
            f_sourcemap.putfile(f)
        ReleaseFile.objects.create(
            name=f"http://example.com/{f_sourcemap.name}",
            release_id=release.id,
            organization_id=project.organization_id,
            file=f_sourcemap,
        )

        data = {
            "timestamp": self.min_ago,
            "message": "hello",
            "platform": "javascript",
            "release": "abc",
            "exception": {
                "values": [
                    {
                        "type": "Error",
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "http://example.com/file.min.js?foo=bar",
                                    "filename": "file.min.js",
                                    "lineno": 1,
                                    "colno": 39,
                                },
                                {
                                    "abs_path": "http://example.com/file.min.js?foo=bar",
                                    "filename": "file.min.js",
                                    "lineno": 1,
                                    "colno": 79,
                                },
                            ]
                        },
                    }
                ]
            },
        }

        event = self.post_and_retrieve_event(data)

        assert "errors" not in event.data

        exception = event.interfaces["exception"]
        frame_list = exception.values[0].stacktrace.frames

        frame = frame_list[0]
        assert frame.pre_context == ["function add(a, b) {", '\t"use strict";']
        assert frame.context_line == "\treturn a + b; // fôo"
        assert frame.post_context == ["}", ""]

        frame = frame_list[1]
        assert frame.pre_context == ["function multiply(a, b) {", '\t"use strict";']
        assert frame.context_line == "\treturn a * b;"
        assert frame.post_context == [
            "}",
            "function divide(a, b) {",
            '\t"use strict";',
            "\ttry {",
            "\t\treturn multiply(add(a, b), a, b) / c;",
        ]

    @responses.activate
    def test_expansion_via_distribution_release_artifacts(self):
        project = self.project
        release = Release.objects.create(organization_id=project.organization_id, version="abc")
        release.add_project(project)
        dist = release.add_dist("foo")

        # file.min.js
        # ------------

        with open(get_fixture_path("file.min.js"), "rb") as f:
            f_minified = File.objects.create(
                name="file.min.js",
                type="release.file",
                headers={"Content-Type": "application/json"},
            )
            f_minified.putfile(f)

        # Intentionally omit hostname - use alternate artifact path lookup instead
        # /file1.js vs http://example.com/file1.js
        ReleaseFile.objects.create(
            name=f"~/{f_minified.name}?foo=bar",
            release_id=release.id,
            dist_id=dist.id,
            organization_id=project.organization_id,
            file=f_minified,
        )

        # file1.js
        # ---------

        with open(get_fixture_path("file1.js"), "rb") as f:
            f1 = File.objects.create(
                name="file1.js", type="release.file", headers={"Content-Type": "application/json"}
            )
            f1.putfile(f)

        ReleaseFile.objects.create(
            name=f"http://example.com/{f1.name}",
            release_id=release.id,
            dist_id=dist.id,
            organization_id=project.organization_id,
            file=f1,
        )

        # file2.js
        # ----------

        with open(get_fixture_path("file2.js"), "rb") as f:
            f2 = File.objects.create(
                name="file2.js", type="release.file", headers={"Content-Type": "application/json"}
            )
            f2.putfile(f)
        ReleaseFile.objects.create(
            name=f"http://example.com/{f2.name}",
            release_id=release.id,
            dist_id=dist.id,
            organization_id=project.organization_id,
            file=f2,
        )

        # To verify that the full url has priority over the relative url,
        # we will also add a second ReleaseFile alias for file2.js (f3) w/o
        # hostname that points to an empty file. If the processor chooses
        # this empty file over the correct file2.js, it will not locate
        # context for the 2nd frame.
        with open(get_fixture_path("empty.js"), "rb") as f:
            f2_empty = File.objects.create(
                name="empty.js", type="release.file", headers={"Content-Type": "application/json"}
            )
            f2_empty.putfile(f)
        ReleaseFile.objects.create(
            name=f"~/{f2.name}",  # intentionally using f2.name ("file2.js")
            release_id=release.id,
            dist_id=dist.id,
            organization_id=project.organization_id,
            file=f2_empty,
        )

        # sourcemap
        # ----------

        with open(get_fixture_path("file.sourcemap.js"), "rb") as f:
            f_sourcemap = File.objects.create(
                name="file.sourcemap.js",
                type="release.file",
                headers={"Content-Type": "application/json"},
            )
            f_sourcemap.putfile(f)
        ReleaseFile.objects.create(
            name=f"http://example.com/{f_sourcemap.name}",
            release_id=release.id,
            dist_id=dist.id,
            organization_id=project.organization_id,
            file=f_sourcemap,
        )

        data = {
            "timestamp": self.min_ago,
            "message": "hello",
            "platform": "javascript",
            "release": "abc",
            "dist": "foo",
            "exception": {
                "values": [
                    {
                        "type": "Error",
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "http://example.com/file.min.js?foo=bar",
                                    "filename": "file.min.js",
                                    "lineno": 1,
                                    "colno": 39,
                                },
                                {
                                    "abs_path": "http://example.com/file.min.js?foo=bar",
                                    "filename": "file.min.js",
                                    "lineno": 1,
                                    "colno": 79,
                                },
                            ]
                        },
                    }
                ]
            },
        }

        event = self.post_and_retrieve_event(data)

        assert "errors" not in event.data

        exception = event.interfaces["exception"]
        frame_list = exception.values[0].stacktrace.frames

        frame = frame_list[0]
        assert frame.pre_context == ["function add(a, b) {", '\t"use strict";']
        assert frame.context_line == "\treturn a + b; // fôo"
        assert frame.post_context == ["}", ""]

        frame = frame_list[1]
        assert frame.pre_context == ["function multiply(a, b) {", '\t"use strict";']
        assert frame.context_line == "\treturn a * b;"
        assert frame.post_context == [
            "}",
            "function divide(a, b) {",
            '\t"use strict";',
            "\ttry {",
            "\t\treturn multiply(add(a, b), a, b) / c;",
        ]

    @responses.activate
    def test_sourcemap_expansion_with_missing_source(self):
        """
        Tests a successful sourcemap expansion that points to source files
        that are not found.
        """
        responses.add(
            responses.GET,
            "http://example.com/file.min.js",
            body=load_fixture("file.min.js"),
            content_type="application/javascript; charset=utf-8",
        )
        responses.add(
            responses.GET,
            "http://example.com/file.sourcemap.js",
            body=load_fixture("file.sourcemap.js"),
            content_type="application/json; charset=utf-8",
        )
        responses.add(responses.GET, "http://example.com/file1.js", body="Not Found", status=404)

        data = {
            "timestamp": self.min_ago,
            "message": "hello",
            "platform": "javascript",
            "exception": {
                "values": [
                    {
                        "type": "Error",
                        "stacktrace": {
                            # Add two frames.  We only want to see the
                            # error once though.
                            "frames": [
                                {
                                    "abs_path": "http://example.com/file.min.js",
                                    "filename": "file.min.js",
                                    "lineno": 1,
                                    "colno": 39,
                                },
                                {
                                    "abs_path": "http://example.com/file.min.js",
                                    "filename": "file.min.js",
                                    "lineno": 1,
                                    "colno": 39,
                                },
                            ]
                        },
                    }
                ]
            },
        }

        event = self.post_and_retrieve_event(data)

        assert event.data["errors"] == [
            {"url": "http://example.com/file1.js", "type": "fetch_invalid_http_code", "value": 404}
        ]

        exception = event.interfaces["exception"]
        frame_list = exception.values[0].stacktrace.frames

        frame = frame_list[0]

        # no context information ...
        assert not frame.pre_context
        assert not frame.context_line
        assert not frame.post_context

        # ... but line, column numbers are still correctly mapped
        assert frame.lineno == 3
        assert frame.colno == 9

    @responses.activate
    def test_failed_sourcemap_expansion(self):
        """
        Tests attempting to parse an indexed source map where each section has a "url"
        property - this is unsupported and should fail.
        """
        responses.add(
            responses.GET,
            "http://example.com/unsupported.min.js",
            body=load_fixture("unsupported.min.js"),
            content_type="application/javascript; charset=utf-8",
        )

        responses.add(
            responses.GET,
            "http://example.com/unsupported.sourcemap.js",
            body=load_fixture("unsupported.sourcemap.js"),
            content_type="application/json; charset=utf-8",
        )

        data = {
            "timestamp": self.min_ago,
            "message": "hello",
            "platform": "javascript",
            "exception": {
                "values": [
                    {
                        "type": "Error",
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "http://example.com/unsupported.min.js",
                                    "filename": "indexed.min.js",
                                    "lineno": 1,
                                    "colno": 39,
                                }
                            ]
                        },
                    }
                ]
            },
        }

        event = self.post_and_retrieve_event(data)

        assert event.data["errors"] == [
            {"url": "http://example.com/unsupported.sourcemap.js", "type": "js_invalid_source"}
        ]

    def test_failed_sourcemap_expansion_data_url(self):
        data = {
            "timestamp": self.min_ago,
            "message": "hello",
            "platform": "javascript",
            "exception": {
                "values": [
                    {
                        "type": "Error",
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "data:application/javascript,base46,asfasf",
                                    "filename": "indexed.min.js",
                                    "lineno": 1,
                                    "colno": 39,
                                }
                            ]
                        },
                    }
                ]
            },
        }

        event = self.post_and_retrieve_event(data)

        assert event.data["errors"] == [{"url": "<data url>", "type": "js_no_source"}]

    @responses.activate
    def test_failed_sourcemap_expansion_missing_location_entirely(self):
        responses.add(
            responses.GET,
            "http://example.com/indexed.min.js",
            body="//# sourceMappingURL=indexed.sourcemap.js",
        )
        responses.add(responses.GET, "http://example.com/indexed.sourcemap.js", body="{}")
        data = {
            "timestamp": self.min_ago,
            "message": "hello",
            "platform": "javascript",
            "exception": {
                "values": [
                    {
                        "type": "Error",
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "http://example.com/indexed.min.js",
                                    "filename": "indexed.min.js",
                                    "lineno": 1,
                                    "colno": 1,
                                },
                                {
                                    "abs_path": "http://example.com/indexed.min.js",
                                    "filename": "indexed.min.js",
                                },
                            ]
                        },
                    }
                ]
            },
        }

        event = self.post_and_retrieve_event(data)

        assert "errors" not in event.data

    @responses.activate
    def test_html_response_for_js(self):
        responses.add(
            responses.GET,
            "http://example.com/file1.js",
            body="       <!DOCTYPE html><html><head></head><body></body></html>",
        )
        responses.add(
            responses.GET,
            "http://example.com/file2.js",
            body="<!doctype html><html><head></head><body></body></html>",
        )
        responses.add(
            responses.GET,
            "http://example.com/file.html",
            body=(
                "<!doctype html><html><head></head><body><script>/*legit case*/</script></body></html>"
            ),
        )

        data = {
            "timestamp": self.min_ago,
            "message": "hello",
            "platform": "javascript",
            "exception": {
                "values": [
                    {
                        "type": "Error",
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "http://example.com/file1.js",
                                    "filename": "file.min.js",
                                    "lineno": 1,
                                    "colno": 39,
                                },
                                {
                                    "abs_path": "http://example.com/file2.js",
                                    "filename": "file.min.js",
                                    "lineno": 1,
                                    "colno": 39,
                                },
                                {
                                    "abs_path": "http://example.com/file.html",
                                    "filename": "file.html",
                                    "lineno": 1,
                                    "colno": 1,
                                },
                            ]
                        },
                    }
                ]
            },
        }

        event = self.post_and_retrieve_event(data)

        assert event.data["errors"] == [
            {"url": "http://example.com/file1.js", "type": "js_invalid_content"},
            {"url": "http://example.com/file2.js", "type": "js_invalid_content"},
        ]

    def _test_expansion_via_release_archive(self, link_sourcemaps: bool):
        project = self.project
        release = Release.objects.create(organization_id=project.organization_id, version="abc")
        release.add_project(project)

        manifest = {
            "org": self.organization.slug,
            "release": release.version,
            "files": {
                "files/_/_/file.min.js": {
                    "url": "http://example.com/file.min.js",
                },
                "files/_/_/file1.js": {
                    "url": "http://example.com/file1.js",
                },
                "files/_/_/file2.js": {
                    "url": "http://example.com/file2.js",
                },
                "files/_/_/file.sourcemap.js": {
                    "url": "http://example.com/file.sourcemap.js",
                },
            },
        }

        file_like = BytesIO()
        with zipfile.ZipFile(file_like, "w") as zip:
            for rel_path, entry in manifest["files"].items():
                name = os.path.basename(rel_path)
                content = load_fixture(name)
                if name == "file.min.js" and not link_sourcemaps:
                    # Remove link to source map, add to header instead
                    content = content.replace(b"//@ sourceMappingURL=file.sourcemap.js", b"")
                    entry["headers"] = {"SourceMap": "/file.sourcemap.js"}
                zip.writestr(rel_path, content)
            zip.writestr("manifest.json", json.dumps(manifest))
        file_like.seek(0)

        file = File.objects.create(name="doesnt_matter", type="release.bundle")
        file.putfile(file_like)

        update_artifact_index(release, None, file)

        data = {
            "timestamp": self.min_ago,
            "message": "hello",
            "platform": "javascript",
            "release": "abc",
            "exception": {
                "values": [
                    {
                        "type": "Error",
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "http://example.com/file.min.js",
                                    "filename": "file.min.js",
                                    "lineno": 1,
                                    "colno": 39,
                                },
                                {
                                    "abs_path": "http://example.com/file.min.js",
                                    "filename": "file.min.js",
                                    "lineno": 1,
                                    "colno": 79,
                                },
                            ]
                        },
                    }
                ]
            },
        }

        event = self.post_and_retrieve_event(data)

        assert "errors" not in event.data

        exception = event.interfaces["exception"]
        frame_list = exception.values[0].stacktrace.frames

        frame = frame_list[0]
        assert frame.pre_context == ["function add(a, b) {", '\t"use strict";']
        assert frame.context_line == "\treturn a + b; // fôo"
        assert frame.post_context == ["}", ""]

        frame = frame_list[1]
        assert frame.pre_context == ["function multiply(a, b) {", '\t"use strict";']
        assert frame.context_line == "\treturn a * b;"
        assert frame.post_context == [
            "}",
            "function divide(a, b) {",
            '\t"use strict";',
            "\ttry {",
            "\t\treturn multiply(add(a, b), a, b) / c;",
        ]

    def test_expansion_via_release_archive(self):
        self._test_expansion_via_release_archive(link_sourcemaps=True)

    def test_expansion_via_release_archive_no_sourcemap_link(self):
        self._test_expansion_via_release_archive(link_sourcemaps=False)

    def test_node_processing(self):
        project = self.project
        release = Release.objects.create(
            organization_id=project.organization_id, version="nodeabc123"
        )
        release.add_project(project)

        with open(get_fixture_path("dist.bundle.js"), "rb") as f:
            f_minified = File.objects.create(
                name="dist.bundle.js",
                type="release.file",
                headers={"Content-Type": "application/javascript"},
            )
            f_minified.putfile(f)
        ReleaseFile.objects.create(
            name=f"~/{f_minified.name}",
            release_id=release.id,
            organization_id=project.organization_id,
            file=f_minified,
        )

        with open(get_fixture_path("dist.bundle.js.map"), "rb") as f:
            f_sourcemap = File.objects.create(
                name="dist.bundle.js.map",
                type="release.file",
                headers={"Content-Type": "application/javascript"},
            )
            f_sourcemap.putfile(f)
        ReleaseFile.objects.create(
            name=f"~/{f_sourcemap.name}",
            release_id=release.id,
            organization_id=project.organization_id,
            file=f_sourcemap,
        )

        data = {
            "timestamp": self.min_ago,
            "message": "hello",
            "platform": "node",
            "release": "nodeabc123",
            "exception": {
                "values": [
                    {
                        "type": "Error",
                        "stacktrace": {
                            "frames": [
                                {
                                    "filename": "app:///dist.bundle.js",
                                    "function": "bar",
                                    "lineno": 9,
                                    "colno": 2321,
                                },
                                {
                                    "filename": "app:///dist.bundle.js",
                                    "function": "foo",
                                    "lineno": 3,
                                    "colno": 2308,
                                },
                                {
                                    "filename": "app:///dist.bundle.js",
                                    "function": "App",
                                    "lineno": 3,
                                    "colno": 1011,
                                },
                                {
                                    "filename": "app:///dist.bundle.js",
                                    "function": "Object.<anonymous>",
                                    "lineno": 1,
                                    "colno": 1014,
                                },
                                {
                                    "filename": "app:///dist.bundle.js",
                                    "function": "__webpack_require__",
                                    "lineno": 20,
                                    "colno": 30,
                                },
                                {
                                    "filename": "app:///dist.bundle.js",
                                    "function": "<unknown>",
                                    "lineno": 18,
                                    "colno": 63,
                                },
                            ]
                        },
                    }
                ]
            },
        }

        event = self.post_and_retrieve_event(data)

        exception = event.interfaces["exception"]
        frame_list = exception.values[0].stacktrace.frames

        assert len(frame_list) == 6

        assert frame_list[0].abs_path == "webpack:///webpack/bootstrap d9a5a31d9276b73873d3"
        assert frame_list[0].function == "bar"
        assert frame_list[0].lineno == 8

        assert frame_list[1].abs_path == "webpack:///webpack/bootstrap d9a5a31d9276b73873d3"
        assert frame_list[1].function == "foo"
        assert frame_list[1].lineno == 2

        assert frame_list[2].abs_path == "webpack:///webpack/bootstrap d9a5a31d9276b73873d3"
        assert frame_list[2].function == "App"
        assert frame_list[2].lineno == 2

        assert frame_list[3].abs_path == "app:///dist.bundle.js"
        # TODO(smcache): Assertion below is the one that's correct. Use it when migrating from legacy processor.
        # assert frame_list[3].abs_path == "webpack:///webpack/bootstrap d9a5a31d9276b73873d3"
        assert frame_list[3].function == "Object.<anonymous>"
        assert frame_list[3].lineno == 1

        assert frame_list[4].abs_path == "webpack:///webpack/bootstrap d9a5a31d9276b73873d3"
        assert frame_list[4].function == "__webpack_require__"
        assert frame_list[4].lineno == 19

        assert frame_list[5].abs_path == "webpack:///webpack/bootstrap d9a5a31d9276b73873d3"
        assert frame_list[5].function == "<unknown>"
        assert frame_list[5].lineno == 16

    @responses.activate
    def test_no_fetch_from_http(self):
        responses.add(
            responses.GET,
            "http://example.com/node_app.min.js",
            body=load_fixture("node_app.min.js"),
            content_type="application/javascript; charset=utf-8",
        )
        responses.add(
            responses.GET,
            "http://example.com/node_app.min.js.map",
            body=load_fixture("node_app.min.js.map"),
            content_type="application/javascript; charset=utf-8",
        )

        data = {
            "timestamp": self.min_ago,
            "message": "hello",
            "platform": "node",
            "exception": {
                "values": [
                    {
                        "type": "Error",
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "node_bootstrap.js",
                                    "filename": "node_bootstrap.js",
                                    "lineno": 1,
                                    "colno": 38,
                                },
                                {
                                    "abs_path": "timers.js",
                                    "filename": "timers.js",
                                    "lineno": 1,
                                    "colno": 39,
                                },
                                {
                                    "abs_path": "webpack:///internal",
                                    "filename": "internal",
                                    "lineno": 1,
                                    "colno": 43,
                                },
                                {
                                    "abs_path": "webpack:///~/some_dep/file.js",
                                    "filename": "file.js",
                                    "lineno": 1,
                                    "colno": 41,
                                },
                                {
                                    "abs_path": "webpack:///./node_modules/file.js",
                                    "filename": "file.js",
                                    "lineno": 1,
                                    "colno": 42,
                                },
                                {
                                    "abs_path": "http://example.com/node_app.min.js",
                                    "filename": "node_app.min.js",
                                    "lineno": 1,
                                    "colno": 40,
                                },
                            ]
                        },
                    }
                ]
            },
        }

        event = self.post_and_retrieve_event(data)

        exception = event.interfaces["exception"]
        frame_list = exception.values[0].stacktrace.frames

        # This one should not process, so this one should be none.
        assert exception.values[0].raw_stacktrace is None

        # None of the in app should update
        for x in range(6):
            assert not frame_list[x].in_app

    @responses.activate
    def test_html_file_with_query_param_ending_with_js_extension(self):
        responses.add(
            responses.GET,
            "http://example.com/file.html",
            body=(
                "<!doctype html><html><head></head><body><script>/*legit case*/</script></body></html>"
            ),
        )
        data = {
            "timestamp": self.min_ago,
            "message": "hello",
            "platform": "javascript",
            "exception": {
                "values": [
                    {
                        "type": "Error",
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "http://example.com/file.html?sw=iddqd1337.js",
                                    "filename": "file.html",
                                    "lineno": 1,
                                    "colno": 1,
                                },
                            ]
                        },
                    }
                ]
            },
        }

        event = self.post_and_retrieve_event(data)

        assert "errors" not in event.data
