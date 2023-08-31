from __future__ import annotations

from typing import Any

import pytest

from sentry.stacktraces.processing import find_stacktraces_in_data, get_crash_frame_from_event_data
from sentry.testutils.cases import TestCase


class FindStacktracesTest(TestCase):
    def test_stacktraces_basics(self):
        data: dict[str, Any] = {
            "message": "hello",
            "platform": "javascript",
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
                        "platform": "native",
                    },
                ]
            },
        }

        infos = find_stacktraces_in_data(data)
        assert len(infos) == 1
        assert len(infos[0].stacktrace["frames"]) == 2
        assert infos[0].platforms == {"javascript", "native"}

    def test_stacktraces_exception(self):
        data: dict[str, Any] = {
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

        infos = find_stacktraces_in_data(data)
        assert len(infos) == 1
        assert len(infos[0].stacktrace["frames"]) == 2

    def test_stacktraces_threads(self):
        data: dict[str, Any] = {
            "message": "hello",
            "platform": "javascript",
            "threads": {
                "values": [
                    {
                        "id": "4711",
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

        infos = find_stacktraces_in_data(data)
        assert len(infos) == 1
        assert len(infos[0].stacktrace["frames"]) == 2

    def test_find_stacktraces_skip_none(self):
        # This tests:
        #  1. exception is None
        #  2. stacktrace is None
        #  3. frames is None
        #  3. frames contains only None
        #  4. frame is None
        data: dict[str, Any] = {
            "message": "hello",
            "platform": "javascript",
            "exception": {
                "values": [
                    None,
                    {"type": "Error", "stacktrace": None},
                    {"type": "Error", "stacktrace": {"frames": None}},
                    {"type": "Error", "stacktrace": {"frames": [None]}},
                    {
                        "type": "Error",
                        "stacktrace": {
                            "frames": [
                                None,
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
                    },
                ]
            },
        }

        infos = find_stacktraces_in_data(data, include_empty_exceptions=True)
        assert len(infos) == 4
        assert sum(1 for x in infos if x.stacktrace) == 3
        assert sum(1 for x in infos if x.is_exception) == 4
        # XXX: The null frame is still part of this stack trace!
        assert len(infos[3].stacktrace["frames"]) == 3

        infos = find_stacktraces_in_data(data)
        assert len(infos) == 1
        # XXX: The null frame is still part of this stack trace!
        assert len(infos[0].stacktrace["frames"]) == 3


@pytest.mark.parametrize(
    "event",
    [
        {"threads": {"values": [{"stacktrace": {"frames": [{"in_app": True, "marco": "polo"}]}}]}},
        {
            "exception": {
                "values": [{"stacktrace": {"frames": [{"in_app": True, "marco": "polo"}]}}]
            }
        },
        {"stacktrace": {"frames": [{"in_app": True, "marco": "polo"}]}},
    ],
)
def test_get_crash_frame(event):
    assert get_crash_frame_from_event_data(event)["marco"] == "polo"
