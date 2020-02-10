# -*- coding: utf-8 -*-

from __future__ import absolute_import


import pytest
from sentry.utils.compat import mock

from sentry import eventstore
from sentry.interfaces.stacktrace import get_context, is_url
from sentry.event_manager import EventManager


def test_is_url():
    assert is_url("http://example.org/") is True
    assert is_url("https://example.org/") is True
    assert is_url("file:///tmp/filename") is True
    assert is_url("applewebdata://00000000-0000-1000-8080-808080808080") is True
    assert is_url("app:///index.bundle") is False  # react native
    assert is_url("webpack:///./app/index.jsx") is False  # webpack bundle
    assert is_url("data:,") is False
    assert is_url("blob:\x00") is False


def test_works_with_empty_filename():
    result = get_context(0, "hello world")
    assert result == [(0, "hello world")]


@pytest.fixture
def make_stacktrace_snapshot(insta_snapshot):
    def inner(data):
        mgr = EventManager(data={"stacktrace": data})
        mgr.normalize()
        evt = eventstore.create_event(data=mgr.get_data())

        interface = evt.interfaces.get("stacktrace")

        insta_snapshot(
            {
                "errors": evt.data.get("errors"),
                "to_json": interface and interface.to_json(),
                "get_stacktrace": interface and interface.get_stacktrace(evt),
                "to_string": interface and interface.to_string(evt),
            }
        )

    return inner


def test_basic(make_stacktrace_snapshot):
    make_stacktrace_snapshot(
        dict(
            frames=[
                {"filename": "foo/bar.py"},
                {"filename": "foo/baz.py", "lineno": 1, "in_app": True},
            ]
        )
    )


@pytest.mark.parametrize("input", [{"frames": [{}]}, {"frames": [{"abs_path": None}]}])
def test_null_values_in_frames(make_stacktrace_snapshot, input):
    make_stacktrace_snapshot(input)


def test_filename(make_stacktrace_snapshot):
    make_stacktrace_snapshot(dict(frames=[{"filename": "foo.py"}]))


def test_filename2(make_stacktrace_snapshot):
    make_stacktrace_snapshot(dict(frames=[{"lineno": 1, "filename": "foo.py"}]))


def test_allows_abs_path_without_filename(make_stacktrace_snapshot):
    make_stacktrace_snapshot(dict(frames=[{"lineno": 1, "abs_path": "foo/bar/baz.py"}]))


def test_coerces_url_filenames(make_stacktrace_snapshot):
    make_stacktrace_snapshot(dict(frames=[{"lineno": 1, "filename": "http://foo.com/foo.js"}]))


def test_does_not_overwrite_filename(make_stacktrace_snapshot):
    make_stacktrace_snapshot(
        dict(frames=[{"lineno": 1, "filename": "foo.js", "abs_path": "http://foo.com/foo.js"}])
    )


def test_ignores_results_with_empty_path(make_stacktrace_snapshot):
    make_stacktrace_snapshot(dict(frames=[{"lineno": 1, "filename": "http://foo.com"}]))


def test_serialize_returns_frames(make_stacktrace_snapshot):
    make_stacktrace_snapshot(dict(frames=[{"lineno": 1, "filename": "foo.py"}]))


@mock.patch("sentry.interfaces.stacktrace.Stacktrace.get_stacktrace", mock.Mock(return_value="foo"))
def test_to_string_returns_stacktrace(make_stacktrace_snapshot):
    make_stacktrace_snapshot(dict(frames=[]))


@mock.patch("sentry.interfaces.stacktrace.is_newest_frame_first", mock.Mock(return_value=False))
def test_get_stacktrace_with_only_filename(make_stacktrace_snapshot):
    make_stacktrace_snapshot(dict(frames=[{"filename": "foo"}, {"filename": "bar"}]))


@mock.patch("sentry.interfaces.stacktrace.is_newest_frame_first", mock.Mock(return_value=False))
def test_get_stacktrace_with_module(make_stacktrace_snapshot):
    make_stacktrace_snapshot(dict(frames=[{"module": "foo"}, {"module": "bar"}]))


@mock.patch("sentry.interfaces.stacktrace.is_newest_frame_first", mock.Mock(return_value=False))
def test_get_stacktrace_with_filename_and_function(make_stacktrace_snapshot):
    make_stacktrace_snapshot(
        dict(
            frames=[{"filename": "foo", "function": "biz"}, {"filename": "bar", "function": "baz"}]
        )
    )


@mock.patch("sentry.interfaces.stacktrace.is_newest_frame_first", mock.Mock(return_value=False))
def test_get_stacktrace_with_filename_function_lineno_and_context(make_stacktrace_snapshot):
    make_stacktrace_snapshot(
        dict(
            frames=[
                {
                    "filename": "foo",
                    "function": "biz",
                    "lineno": 3,
                    "context_line": "  def foo(r):",
                },
                {
                    "filename": "bar",
                    "function": "baz",
                    "lineno": 5,
                    "context_line": "    return None",
                },
            ]
        )
    )
